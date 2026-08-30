package com.dongle.server.swipe

import com.dongle.server.auth.jwt.JwtTokenProvider
import com.dongle.server.place.Place
import com.dongle.server.place.PlaceCategory
import com.dongle.server.place.PlaceRepository
import com.dongle.server.place.PlaceSemanticVector
import com.dongle.server.place.PlaceSemanticVectorRepository
import com.dongle.server.user.OAuthProvider
import com.dongle.server.user.User
import com.dongle.server.user.UserPreference
import com.dongle.server.user.UserPreferenceRepository
import com.dongle.server.user.UserRepository
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Primary
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.method
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.client.RestClient
import tools.jackson.databind.PropertyNamingStrategies
import tools.jackson.databind.json.JsonMapper
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime

// place_recommender에 실제 네트워크 요청을 보내지 않도록, ImageProxyApiIntegrationTest와 동일한 방식으로
// placeRecommenderRestClient 빈을 MockRestServiceServer에 바인딩한 것으로 대체한다 (@Primary).
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class SwipeApiIntegrationTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var placeRepository: PlaceRepository

    @Autowired
    lateinit var placeSemanticVectorRepository: PlaceSemanticVectorRepository

    @Autowired
    lateinit var userPreferenceRepository: UserPreferenceRepository

    @Autowired
    lateinit var swipeSessionRepository: SwipeSessionRepository

    @Autowired
    lateinit var swipeSessionCandidateRepository: SwipeSessionCandidateRepository

    @Autowired
    lateinit var jwtTokenProvider: JwtTokenProvider

    @AfterEach
    fun resetMockServer() {
        mockServer.reset()
    }

    @TestConfiguration
    class MockPlaceRecommenderRestClientConfig {
        // PlaceRecommenderClient는 CourseOptimizerClient와 마찬가지로 상대 경로(.uri("/v1/places/recommend"))만
        // 넘기고 baseUrl에 의존해서 절대 URI를 만든다 — ImageProxy 쪽(절대 URI를 직접 조립)과 달리
        // 여기서도 baseUrl을 반드시 명시해야 함. 정적 팩토리 RestClient.builder()의 기본 컨버터는
        // 전역 SNAKE_CASE 설정을 안 물려받으므로 PlaceRecommenderHttpConfig와 동일한 컨버터를 직접 꽂아야
        // place_id 같은 snake_case 응답 필드가 정상 파싱된다 (안 그러면 HttpMessageNotReadableException)
        @Bean
        @Primary
        fun testPlaceRecommenderRestClient(): RestClient {
            val mapper = JsonMapper.builder()
                .propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
                .build()
            val builder = RestClient.builder()
                .baseUrl(MOCK_BASE_URL)
                .messageConverters { it.add(0, JacksonJsonHttpMessageConverter(mapper)) }
            mockServer = MockRestServiceServer.bindTo(builder).build()
            return builder.build()
        }
    }

    companion object {
        private lateinit var mockServer: MockRestServiceServer
        private const val MOCK_BASE_URL = "http://test-place-recommender"
    }

    private fun user(userId: String, oauthId: String) =
        userRepository.save(User(userId = userId, nickname = "테스터", oauthProvider = OAuthProvider.kakao, oauthId = oauthId))

    private fun place(contentId: String, name: String) = placeRepository.save(
        Place(
            contentId = contentId,
            contentTypeId = 12,
            category = PlaceCategory.관광지,
            name = name,
            addr1 = "경북 안동시",
            lat = 36.5389,
            lng = 128.5169,
            mainImageUrl = "https://example.com/$contentId.jpg",
        )
    )

    private fun semanticVector(placeId: Long) = placeSemanticVectorRepository.save(
        PlaceSemanticVector(
            placeId = placeId,
            representativeImageUrl = "https://example.com/rep-$placeId.jpg",
            analysisImageCount = 3,
            majorScores = """{"relaxing":0.9,"lively":0.1,"romantic":0.1,"local":0.1,"photogenic":0.1,"traditional":0.05,"modern":0.05}""",
            detailScores = "{}",
            modelName = "test-model",
            promptVersion = "test-v1",
            tagSchemaVersion = "test-v1",
            qdrantPointId = "test-point-$placeId",
            analyzedAt = OffsetDateTime.now(),
        )
    )

    private fun mockRecommend(vararg placeIds: Long) {
        val recommendations = placeIds.joinToString(",") { id ->
            """{"place_id":"$id","similarity_score":0.8,"hidden_score":0.3,"recommendation_score":0.75}"""
        }
        mockServer.expect(requestTo("$MOCK_BASE_URL/v1/places/recommend"))
            .andExpect(method(HttpMethod.POST))
            .andRespond(withSuccess("""{"recommendations":[$recommendations]}""", MediaType.APPLICATION_JSON))
    }

    @Test
    fun `스와이프 후보를 요청하면 세션이 발급되고 후보 카드 목록을 반환한다`() {
        val owner = user("swipe_user_1", "kakao-swipe-1")
        val token = jwtTokenProvider.generateAccessToken(owner.id)
        val place = place("SWIPE001", "테스트전용스와이프후보장소")
        semanticVector(place.id)
        mockRecommend(place.id)

        mockMvc.perform(
            post("/swipe/candidates")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"travel_date":"2026-09-01","transport":"walk"}""")
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.session_id").value(org.hamcrest.Matchers.startsWith("swipe_session_")))
            .andExpect(jsonPath("$.candidates.length()").value(1))
            .andExpect(jsonPath("$.candidates[0].place_id").value(place.id))
            .andExpect(jsonPath("$.candidates[0].name").value("테스트전용스와이프후보장소"))
            .andExpect(jsonPath("$.candidates[0].category").value("관광지"))

        mockServer.verify()
    }

    @Test
    fun `발급받은 세션을 재조회하면 잔여 후보와 진행상태를 복원한다`() {
        val owner = user("swipe_user_2", "kakao-swipe-2")
        val token = jwtTokenProvider.generateAccessToken(owner.id)
        val place = place("SWIPE002", "테스트전용세션복원장소")
        mockRecommend(place.id)

        val sessionId = mockMvc.perform(
            post("/swipe/candidates")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"travel_date":"2026-09-01","transport":"car"}""")
        ).andReturn().response.contentAsString.let {
            it.substringAfter("\"session_id\":\"").substringBefore("\"")
        }

        mockMvc.perform(get("/swipe/sessions/$sessionId").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.travel_date").value("2026-09-01"))
            .andExpect(jsonPath("$.transport").value("car"))
            .andExpect(jsonPath("$.candidates.length()").value(1))
            .andExpect(jsonPath("$.swiped_results.length()").value(0))
    }

    @Test
    fun `스와이프 결과를 제출하면 취향 점수가 갱신되고 세션 재조회 시 결과로 반영된다`() {
        val owner = user("swipe_user_3", "kakao-swipe-3")
        val token = jwtTokenProvider.generateAccessToken(owner.id)
        val place = place("SWIPE003", "테스트전용결과제출장소")
        semanticVector(place.id)
        mockRecommend(place.id)

        val sessionId = mockMvc.perform(
            post("/swipe/candidates")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"travel_date":"2026-09-01","transport":"walk"}""")
        ).andReturn().response.contentAsString.let {
            it.substringAfter("\"session_id\":\"").substringBefore("\"")
        }

        mockMvc.perform(
            post("/swipe/sessions/$sessionId/results")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"swipes":[{"place_id":${place.id},"action":"like"}]}""")
        ).andExpect(status().isNoContent)

        mockMvc.perform(get("/swipe/sessions/$sessionId").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.candidates.length()").value(0))
            .andExpect(jsonPath("$.swiped_results.length()").value(1))
            .andExpect(jsonPath("$.swiped_results[0].place_id").value(place.id))
            .andExpect(jsonPath("$.swiped_results[0].action").value("like"))

        val relaxingScore = userPreferenceRepository.findByUserIdAndTag(owner.id, "relaxing")?.score
        assert(relaxingScore != null && relaxingScore > 0.5) {
            "like로 인해 relaxing 점수가 중립(0.5)보다 올라가야 하는데 $relaxingScore"
        }
    }

    @Test
    fun `만료된 세션을 조회하면 410을 반환한다`() {
        val owner = user("swipe_user_4", "kakao-swipe-4")
        val token = jwtTokenProvider.generateAccessToken(owner.id)
        val expired = swipeSessionRepository.save(
            SwipeSession(
                id = "swipe_session_test-expired",
                user = owner,
                travelDate = LocalDate.of(2026, 9, 1),
                transport = SwipeTransport.walk,
                expiresAt = LocalDateTime.now().minusHours(1),
            )
        )

        mockMvc.perform(get("/swipe/sessions/${expired.id}").header("Authorization", "Bearer $token"))
            .andExpect(status().isGone)
            .andExpect(jsonPath("$.code").value("SESSION_EXPIRED"))
    }

    @Test
    fun `본인 세션이 아니면 403을 반환한다`() {
        val owner = user("swipe_user_5a", "kakao-swipe-5a")
        val other = user("swipe_user_5b", "kakao-swipe-5b")
        val otherToken = jwtTokenProvider.generateAccessToken(other.id)
        val session = swipeSessionRepository.save(
            SwipeSession(
                id = "swipe_session_test-forbidden",
                user = owner,
                travelDate = LocalDate.of(2026, 9, 1),
                transport = SwipeTransport.walk,
                expiresAt = LocalDateTime.now().plusHours(1),
            )
        )

        mockMvc.perform(get("/swipe/sessions/${session.id}").header("Authorization", "Bearer $otherToken"))
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.code").value("SWIPE_SESSION_ACCESS_DENIED"))
    }
}
