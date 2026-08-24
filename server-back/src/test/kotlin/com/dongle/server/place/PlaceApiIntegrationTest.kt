package com.dongle.server.place

import com.dongle.server.auth.jwt.JwtTokenProvider
import com.dongle.server.user.OAuthProvider
import com.dongle.server.user.User
import com.dongle.server.user.UserRepository
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
                majorScores = """{"relaxing":0.9,"lively":0.1,"romantic":0.2,"local":0.3,"photogenic":0.4,"traditional":0.05,"modern":0.05}""",
                detailScores = "{}",
                modelName = "test-model",
                promptVersion = "test-v1",
                analyzedAt = OffsetDateTime.now(),
            )
        )

        mockMvc.perform(get("/places/${place.id}"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.top_tags[0]").value("relaxing"))
            .andExpect(jsonPath("$.top_tags.length()").value(7))
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
