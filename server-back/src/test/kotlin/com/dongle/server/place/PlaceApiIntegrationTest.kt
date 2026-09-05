package com.dongle.server.place

import com.dongle.server.auth.jwt.JwtTokenProvider
import com.dongle.server.user.OAuthProvider
import com.dongle.server.user.User
import com.dongle.server.user.UserPreference
import com.dongle.server.user.UserPreferenceRepository
import com.dongle.server.user.UserRepository
import com.dongle.server.visitlog.VisitLog
import com.dongle.server.visitlog.VisitLogRepository
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.annotation.Transactional
import java.time.LocalTime
import java.time.OffsetDateTime

// 안동 시내(하회마을 인근) 좌표대를 뷰포트/장소 좌표로 사용
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PlaceApiIntegrationTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var placeRepository: PlaceRepository

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var jwtTokenProvider: JwtTokenProvider

    @Autowired
    lateinit var placeSemanticVectorRepository: PlaceSemanticVectorRepository

    @Autowired
    lateinit var placeHoursRepository: PlaceHoursRepository

    @Autowired
    lateinit var userPreferenceRepository: UserPreferenceRepository

    @Autowired
    lateinit var visitLogRepository: VisitLogRepository

    private fun place(contentId: String, name: String, lat: Double, lng: Double, visitLogCount: Int = 0) = placeRepository.save(
        Place(
            contentId = contentId,
            contentTypeId = 12,
            category = PlaceCategory.관광지,
            name = name,
            addr1 = "경북 안동시",
            lat = lat,
            lng = lng,
            visitLogCount = visitLogCount,
        )
    )

    private fun accessTokenFor(userId: String, oauthId: String): String {
        val user = userRepository.save(
            User(userId = userId, nickname = "테스터", oauthProvider = OAuthProvider.kakao, oauthId = oauthId)
        )
        return jwtTokenProvider.generateAccessToken(user.id)
    }

    private fun userWithToken(userId: String, oauthId: String): Pair<Long, String> {
        val user = userRepository.save(
            User(userId = userId, nickname = "테스터", oauthProvider = OAuthProvider.kakao, oauthId = oauthId)
        )
        return user.id to jwtTokenProvider.generateAccessToken(user.id)
    }

    // 공용 Supabase DB를 대상으로 실행되므로(실제 데이터가 계속 쌓임), total/개수 같은 절대값 대신
    // 테스트 전용 고유 이름으로 "포함 여부"만 확인해야 실제 데이터 적재와 무관하게 안정적으로 통과함
    @Test
    fun `뷰포트 안의 장소만 지도 핀으로 반환한다`() {
        place("MAP001", "테스트전용지도장소-포함", 36.5389, 128.5169)
        place("MAP002", "테스트전용지도장소-제외", 36.5684, 128.7294) // 뷰포트 밖

        mockMvc.perform(get("/places/map").param("bounds", "36.50,128.50,36.55,128.55"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.pins[?(@.name == '테스트전용지도장소-포함')]").exists())
            .andExpect(jsonPath("$.pins[?(@.name == '테스트전용지도장소-제외')]").doesNotExist())
    }

    @Test
    fun `키워드로 장소를 검색할 수 있다`() {
        place("SEARCH001", "테스트전용검색키워드ZZZ-하회마을", 36.5389, 128.5169)
        place("SEARCH002", "병산서원", 36.5, 128.5)

        mockMvc.perform(get("/places/search").param("q", "테스트전용검색키워드ZZZ"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.places.length()").value(1))
            .andExpect(jsonPath("$.places[0].name").value("테스트전용검색키워드ZZZ-하회마을"))
    }

    @Test
    fun `인기순으로 추천 장소를 반환하고 비인증은 개인화 아님`() {
        place("FEAT001", "인기적은곳", 36.5, 128.5, visitLogCount = 1)
        place("FEAT002", "인기많은곳", 36.5, 128.5, visitLogCount = 100)

        mockMvc.perform(get("/places/featured").param("limit", "2"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.is_personalized").value(false))
            .andExpect(jsonPath("$.places[0].name").value("인기많은곳"))
    }

    @Test
    fun `취향 태그와 겹치는 장소가 있으면 개인화 추천을 반환하고 매칭 장소를 우선 노출한다`() {
        val (userId, token) = userWithToken("feat_user_1", "kakao-feat-1")
        userPreferenceRepository.save(
            UserPreference(user = userRepository.getReferenceById(userId), tag = "relaxing", score = 5.0)
        )

        val matched = place("FEAT_MATCH", "테스트전용개인화매칭장소", 36.5, 128.5)
        placeSemanticVectorRepository.save(
            PlaceSemanticVector(
                placeId = matched.id,
                representativeImageUrl = "https://example.com/matched.jpg",
                analysisImageCount = 3,
                majorScores = """{"relaxing":0.9,"lively":0.1,"romantic":0.1,"local":0.1,"photogenic":0.1,"traditional":0.05,"modern":0.05}""",
                detailScores = "{}",
                modelName = "test-model",
                promptVersion = "test-v1",
                tagSchemaVersion = "test-v1",
                qdrantPointId = "test-point-matched",
                analyzedAt = OffsetDateTime.now(),
            )
        )
        val unmatched = place("FEAT_NOMATCH", "테스트전용개인화비매칭장소", 36.5, 128.5)
        placeSemanticVectorRepository.save(
            PlaceSemanticVector(
                placeId = unmatched.id,
                representativeImageUrl = "https://example.com/unmatched.jpg",
                analysisImageCount = 3,
                majorScores = """{"relaxing":0.05,"lively":0.9,"romantic":0.8,"local":0.7,"photogenic":0.1,"traditional":0.05,"modern":0.05}""",
                detailScores = "{}",
                modelName = "test-model",
                promptVersion = "test-v1",
                tagSchemaVersion = "test-v1",
                qdrantPointId = "test-point-unmatched",
                analyzedAt = OffsetDateTime.now(),
            )
        )

        // limit을 전체 장소 수보다 훨씬 크게 줘서 두 테스트 장소가 반드시 응답에 포함되도록 함
        val response = mockMvc.perform(
            get("/places/featured").param("limit", "5000").header("Authorization", "Bearer $token")
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.is_personalized").value(true))
            .andReturn().response.contentAsString

        val matchedIndex = response.indexOf("테스트전용개인화매칭장소")
        val unmatchedIndex = response.indexOf("테스트전용개인화비매칭장소")
        assertTrue(matchedIndex in 0..<unmatchedIndex) {
            "취향 태그와 겹치는 장소가 더 앞에 나와야 함 (matched=$matchedIndex, unmatched=$unmatchedIndex)"
        }
    }

    @Test
    fun `취향 태그가 없으면 인기순으로 폴백하고 비개인화로 표시한다`() {
        val (_, token) = userWithToken("feat_user_2", "kakao-feat-2")

        mockMvc.perform(get("/places/featured").param("limit", "2").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.is_personalized").value(false))
    }

    @Test
    fun `좋아요를 추가하고 중복 요청하면 409를 반환한다`() {
        val place = place("LIKE001", "하회마을", 36.5389, 128.5169)
        val token = accessTokenFor("like_user_1", "kakao-like-1")

        mockMvc.perform(post("/places/${place.id}/like").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.is_liked").value(true))

        mockMvc.perform(post("/places/${place.id}/like").header("Authorization", "Bearer $token"))
            .andExpect(status().isConflict)
    }

    @Test
    fun `좋아요를 취소하면 목록 조회에서 is_liked가 false가 된다`() {
        val place = place("LIKE002", "병산서원", 36.5, 128.5)
        val token = accessTokenFor("like_user_2", "kakao-like-2")

        mockMvc.perform(post("/places/${place.id}/like").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)

        mockMvc.perform(get("/places/${place.id}").header("Authorization", "Bearer $token"))
            .andExpect(jsonPath("$.is_liked").value(true))

        mockMvc.perform(delete("/places/${place.id}/like").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.is_liked").value(false))

        mockMvc.perform(get("/places/${place.id}").header("Authorization", "Bearer $token"))
            .andExpect(jsonPath("$.is_liked").value(false))

        mockMvc.perform(delete("/places/${place.id}/like").header("Authorization", "Bearer $token"))
            .andExpect(status().isNotFound)
    }

    @Test
    fun `좋아요는 인증 없이 호출하면 401을 반환한다`() {
        val place = place("LIKE003", "월영교", 36.55, 128.72)

        mockMvc.perform(post("/places/${place.id}/like"))
            .andExpect(status().isUnauthorized)
    }

    @Test
    fun `방문 로그 태그가 없으면 place_semantic_vector major_scores로 대체된다`() {
        val place = place("SEM001", "테스트전용시맨틱장소", 36.5, 128.5)
        placeSemanticVectorRepository.save(
            PlaceSemanticVector(
                placeId = place.id,
                representativeImageUrl = "https://example.com/a.jpg",
                analysisImageCount = 3,
                majorScores = """{"relaxing":0.9,"lively":0.1,"romantic":0.2,"local":0.3,"photogenic":0.4,"traditional":0.05,"modern":0.05}""",
                detailScores = "{}",
                modelName = "test-model",
                promptVersion = "test-v1",
                tagSchemaVersion = "test-v1",
                qdrantPointId = "test-point-sem001",
                analyzedAt = OffsetDateTime.now(),
            )
        )

        mockMvc.perform(get("/places/${place.id}"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.top_tags[0]").value("relaxing"))
            .andExpect(jsonPath("$.top_tags.length()").value(7))
    }

    @Test
    fun `장소 상세 조회 시 요일별 영업시간을 반환한다`() {
        val place = place("HOURS001", "테스트전용영업시간장소", 36.5, 128.5)
        placeHoursRepository.save(PlaceHours(place = place, openDay = 1, openTime = LocalTime.of(9, 0), closeTime = LocalTime.of(18, 0)))
        placeHoursRepository.save(PlaceHours(place = place, openDay = 6, openTime = LocalTime.of(22, 0), closeDay = 0, closeTime = LocalTime.of(2, 0)))

        mockMvc.perform(get("/places/${place.id}"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.hours.length()").value(2))
            .andExpect(jsonPath("$.hours[0].open_day").value(1))
            .andExpect(jsonPath("$.hours[0].open_time").value("09:00:00"))
            .andExpect(jsonPath("$.hours[0].close_time").value("18:00:00"))
            .andExpect(jsonPath("$.hours[1].close_day").value(0))
    }

    @Test
    fun `영업시간 데이터가 없으면 빈 배열을 반환한다`() {
        val place = place("HOURS002", "테스트전용영업시간없는장소", 36.5, 128.5)

        mockMvc.perform(get("/places/${place.id}"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.hours.length()").value(0))
    }

    @Test
    fun `방문 기록 별점의 평균이 장소 상세에 노출된다`() {
        val place = place("RATING001", "테스트전용별점장소", 36.5, 128.5)
        val (userId1, _) = userWithToken("rating_user_1", "kakao-rating-1")
        val (userId2, _) = userWithToken("rating_user_2", "kakao-rating-2")
        val user1 = userRepository.getReferenceById(userId1)
        val user2 = userRepository.getReferenceById(userId2)

        // 별점 없이 남긴 기록은 평균 계산에서 제외되어야 함
        visitLogRepository.save(VisitLog(user = user1, place = place, oneLine = "별점 없음"))
        visitLogRepository.save(VisitLog(user = user1, place = place, rating = 4))
        visitLogRepository.save(VisitLog(user = user2, place = place, rating = 2))

        mockMvc.perform(get("/places/${place.id}"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.avg_rating").value(3.0))
    }

    @Test
    fun `방문 기록에 별점이 하나도 없으면 avg_rating은 null이다`() {
        val place = place("RATING002", "테스트전용별점없는장소", 36.5, 128.5)

        mockMvc.perform(get("/places/${place.id}"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.avg_rating").doesNotExist())
    }

    @Test
    fun `내 프로필을 수정할 수 있다`() {
        val token = accessTokenFor("update_user_1", "kakao-update-1")

        mockMvc.perform(
            patch("/users/me")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"nickname":"새닉네임"}""")
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.nickname").value("새닉네임"))
    }
}
