package com.dongle.server.visitlog

import com.dongle.server.auth.jwt.JwtTokenProvider
import com.dongle.server.place.Place
import com.dongle.server.place.PlaceCategory
import com.dongle.server.place.PlaceRepository
import com.dongle.server.user.OAuthProvider
import com.dongle.server.user.User
import com.dongle.server.user.UserRepository
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class VisitLogApiIntegrationTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var placeRepository: PlaceRepository

    @Autowired
    lateinit var visitLogRepository: VisitLogRepository

    @Autowired
    lateinit var jwtTokenProvider: JwtTokenProvider

    private fun user(userId: String, oauthId: String) =
        userRepository.save(User(userId = userId, nickname = "테스터", oauthProvider = OAuthProvider.kakao, oauthId = oauthId))

    private fun place(contentId: String, name: String, visitLogCount: Int = 0) = placeRepository.save(
        Place(
            contentId = contentId,
            contentTypeId = 12,
            category = PlaceCategory.관광지,
            name = name,
            addr1 = "경북 안동시",
            lat = 36.5389,
            lng = 128.5169,
            visitLogCount = visitLogCount,
        )
    )

    private fun log(user: User, place: Place, oneLine: String = "좋았어요", tags: List<String> = listOf("relaxing")): VisitLog {
        val saved = visitLogRepository.save(VisitLog(user = user, place = place, oneLine = oneLine))
        tags.forEach { saved.emotionTags.add(LogEmotionTag(visitLog = saved, tag = it)) }
        return visitLogRepository.save(saved)
    }

    @Test
    fun `여행 기록을 작성하면 장소의 방문 카운트가 증가하고 태그는 빈 배열로 응답한다`() {
        val owner = user("log_user_create_1", "kakao-log-create-1")
        val token = jwtTokenProvider.generateAccessToken(owner.id)
        val place = place("LOG_CREATE001", "테스트전용기록작성장소", visitLogCount = 2)

        mockMvc.perform(
            post("/places/${place.id}/logs")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"photo_url":"https://example.com/a.jpg","one_line":"테스트전용신규기록","visited_at":"2026-08-01T10:00:00"}""")
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.place_id").value(place.id))
            .andExpect(jsonPath("$.place_name").value("테스트전용기록작성장소"))
            .andExpect(jsonPath("$.one_line").value("테스트전용신규기록"))
            .andExpect(jsonPath("$.photo_url").value("https://example.com/a.jpg"))
            // AI 이미지 분석 미연동(2026-08-30 결정) — 태그는 항상 빈 배열
            .andExpect(jsonPath("$.tags.length()").value(0))

        val updatedPlace = placeRepository.findById(place.id).orElseThrow()
        assert(updatedPlace.visitLogCount == 3) { "visitLogCount expected 3 but was ${updatedPlace.visitLogCount}" }
    }

    @Test
    fun `사진과 방문일 없이도 여행 기록을 작성할 수 있다`() {
        val owner = user("log_user_create_2", "kakao-log-create-2")
        val token = jwtTokenProvider.generateAccessToken(owner.id)
        val place = place("LOG_CREATE002", "테스트전용최소필드장소")

        mockMvc.perform(
            post("/places/${place.id}/logs")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"one_line":"테스트전용최소필드기록"}""")
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.photo_url").doesNotExist())
            .andExpect(jsonPath("$.visited_at").exists())
    }

    @Test
    fun `존재하지 않는 장소에 기록을 작성하면 404를 반환한다`() {
        val owner = user("log_user_create_3", "kakao-log-create-3")
        val token = jwtTokenProvider.generateAccessToken(owner.id)

        mockMvc.perform(
            post("/places/999999999/logs")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"one_line":"테스트"}""")
        )
            .andExpect(status().isNotFound)
    }

    @Test
    fun `인증 없이 여행 기록을 작성하면 401을 반환한다`() {
        val place = place("LOG_CREATE004", "테스트전용비인증장소")

        mockMvc.perform(
            post("/places/${place.id}/logs")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"one_line":"테스트"}""")
        )
            .andExpect(status().isUnauthorized)
    }

    @Test
    fun `내 여행 기록 목록을 조회할 수 있다`() {
        val owner = user("log_user_1", "kakao-log-1")
        val token = jwtTokenProvider.generateAccessToken(owner.id)
        val place = place("LOG001", "테스트전용기록장소A")
        log(owner, place, oneLine = "테스트전용한줄리뷰-목록")

        mockMvc.perform(get("/users/me/logs").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.logs[?(@.one_line == '테스트전용한줄리뷰-목록')]").exists())
    }

    @Test
    fun `장소별 기록 목록은 비인증으로도 조회 가능하다`() {
        val owner = user("log_user_2", "kakao-log-2")
        val place = place("LOG002", "테스트전용기록장소B")
        log(owner, place, oneLine = "테스트전용한줄리뷰-장소별")

        mockMvc.perform(get("/places/${place.id}/logs"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.logs[?(@.one_line == '테스트전용한줄리뷰-장소별')]").exists())
    }

    @Test
    fun `존재하지 않는 장소의 기록을 조회하면 404를 반환한다`() {
        mockMvc.perform(get("/places/999999999/logs"))
            .andExpect(status().isNotFound)
    }

    @Test
    fun `기록 상세를 조회하고 한줄리뷰와 방문일을 수정할 수 있다`() {
        val owner = user("log_user_3", "kakao-log-3")
        val token = jwtTokenProvider.generateAccessToken(owner.id)
        val place = place("LOG003", "테스트전용기록장소C")
        val savedLog = log(owner, place, oneLine = "수정전")

        mockMvc.perform(get("/logs/${savedLog.id}").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.one_line").value("수정전"))

        mockMvc.perform(
            patch("/logs/${savedLog.id}")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"one_line":"수정후"}""")
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.one_line").value("수정후"))
    }

    @Test
    fun `기록을 삭제하면 장소의 방문 카운트가 감소하고 해당 기록의 감성태그가 장소 상위 태그에서 더 이상 집계되지 않는다`() {
        val owner = user("log_user_4", "kakao-log-4")
        val token = jwtTokenProvider.generateAccessToken(owner.id)
        val place = place("LOG004", "테스트전용기록장소D", visitLogCount = 5)
        // log_emotion_tag를 조회 시점에 직접 집계하므로(place_emotion_tag 카운터 테이블 제거,
        // 2026-09-02 결정) 삭제 전/후로 장소 상세의 top_tags가 실제로 바뀌는지로 검증한다
        val savedLog = log(owner, place, tags = listOf("relaxing"))

        mockMvc.perform(get("/places/${place.id}"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.top_tags[?(@ == 'relaxing')]").exists())

        mockMvc.perform(delete("/logs/${savedLog.id}").header("Authorization", "Bearer $token"))
            .andExpect(status().isNoContent)

        val updatedPlace = placeRepository.findById(place.id).orElseThrow()
        assert(updatedPlace.visitLogCount == 4) { "visitLogCount expected 4 but was ${updatedPlace.visitLogCount}" }

        mockMvc.perform(get("/places/${place.id}"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.top_tags[?(@ == 'relaxing')]").doesNotExist())

        mockMvc.perform(get("/logs/${savedLog.id}").header("Authorization", "Bearer $token"))
            .andExpect(status().isNotFound)
    }

    @Test
    fun `다른 사용자의 기록을 조회하면 403을 반환한다`() {
        val owner = user("log_user_5", "kakao-log-5")
        val stranger = user("log_user_6", "kakao-log-6")
        val strangerToken = jwtTokenProvider.generateAccessToken(stranger.id)
        val place = place("LOG005", "테스트전용기록장소E")
        val savedLog = log(owner, place)

        mockMvc.perform(get("/logs/${savedLog.id}").header("Authorization", "Bearer $strangerToken"))
            .andExpect(status().isForbidden)
    }

    @Test
    fun `인증 없이 내 기록 목록을 조회하면 401을 반환한다`() {
        mockMvc.perform(get("/users/me/logs"))
            .andExpect(status().isUnauthorized)
    }
}
