package com.dongle.server.course

import com.dongle.server.auth.jwt.JwtTokenProvider
import com.dongle.server.place.Place
import com.dongle.server.place.PlaceCategory
import com.dongle.server.place.PlaceRepository
import com.dongle.server.place.PlaceSemanticVector
import com.dongle.server.place.PlaceSemanticVectorRepository
import com.dongle.server.swipe.SwipeAction
import com.dongle.server.swipe.SwipeSession
import com.dongle.server.swipe.SwipeSessionCandidate
import com.dongle.server.swipe.SwipeSessionCandidateRepository
import com.dongle.server.swipe.SwipeSessionRepository
import com.dongle.server.swipe.SwipeTransport
import com.dongle.server.user.OAuthProvider
import com.dongle.server.user.User
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

// course_optimizer에 실제 네트워크 요청을 보내지 않도록, SwipeApiIntegrationTest와 동일한 방식으로
// courseOptimizerRestClient 빈을 MockRestServiceServer 바인딩으로 대체한다 (@Primary).
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CourseGenerateApiIntegrationTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var placeRepository: PlaceRepository

    @Autowired
    lateinit var placeSemanticVectorRepository: PlaceSemanticVectorRepository

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
    class MockCourseOptimizerRestClientConfig {
        @Bean
        @Primary
        fun testCourseOptimizerRestClient(): RestClient {
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
        private const val MOCK_BASE_URL = "http://test-course-optimizer"
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
            majorScores = """{"relaxing":0.8,"lively":0.2,"romantic":0.2,"local":0.3,"photogenic":0.6,"traditional":0.7,"modern":0.1}""",
            detailScores = "{}",
            modelName = "test-model",
            promptVersion = "test-v1",
            tagSchemaVersion = "test-v1",
            qdrantPointId = "test-point-$placeId",
            analyzedAt = OffsetDateTime.now(),
        )
    )

    // /swipe/candidates·/swipe/sessions/{id}/results를 거치지 않고 세션/후보를 직접 만들어
    // course_optimizer 연동 자체만 검증한다 (place_recommender 모킹은 SwipeApiIntegrationTest가 이미 커버)
    private fun sessionWithLikedCandidates(owner: User, places: List<Place>): SwipeSession {
        val session = swipeSessionRepository.save(
            SwipeSession(
                id = "swipe_session_test-course-${owner.id}",
                user = owner,
                travelDate = LocalDate.of(2026, 9, 1),
                transport = SwipeTransport.walk,
                expiresAt = LocalDateTime.now().plusHours(24),
            )
        )
        places.forEachIndexed { index, place ->
            swipeSessionCandidateRepository.save(
                SwipeSessionCandidate(session = session, place = place, sortOrder = index, action = SwipeAction.like)
            )
        }
        return session
    }

    private fun mockOptimize(vararg placeIds: Long) {
        val stops = placeIds.joinToString(",") { id ->
            """
            {
              "place_id": "$id",
              "arrival_time": "2026-09-01T09:30:00",
              "visit_start_time": "2026-09-01T09:30:00",
              "departure_time": "2026-09-01T10:30:00",
              "actual_stay_minutes": 60
            }
            """.trimIndent()
        }
        mockServer.expect(requestTo("$MOCK_BASE_URL/v1/courses/optimize"))
            .andExpect(method(HttpMethod.POST))
            .andRespond(
                withSuccess(
                    """
                    {
                      "selected_route": {
                        "stops": [$stops],
                        "score": {
                          "time_score": 0.8, "transition_score": 0.7, "balance_score": 0.6,
                          "experience_score": 0.75, "total_travel_minutes": 25, "travel_score": 0.9, "total_score": 0.82
                        }
                      },
                      "candidate_route_count": 1, "evaluated_route_count": 1, "target_visit_count": ${placeIds.size},
                      "free_time_minutes": 30, "prompt_version": "course-eval-v1", "model_name": "gpt-4.1-mini",
                      "excluded_place_ids": [], "excluded_places": [], "exclusion_reason": {}, "replaced_places": {}
                    }
                    """.trimIndent(),
                    MediaType.APPLICATION_JSON,
                )
            )
    }

    @Test
    fun `스와이프에서 좋아요한 장소로 코스 후보를 생성한다`() {
        val owner = user("course_gen_user_1", "kakao-course-gen-1")
        val token = jwtTokenProvider.generateAccessToken(owner.id)
        val placeA = place("COURSEGEN001", "테스트전용코스생성장소A")
        val placeB = place("COURSEGEN002", "테스트전용코스생성장소B")
        semanticVector(placeA.id)
        semanticVector(placeB.id)
        val session = sessionWithLikedCandidates(owner, listOf(placeA, placeB))
        mockOptimize(placeA.id, placeB.id)

        mockMvc.perform(
            post("/courses/generate")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"session_id":"${session.id}","travel_date":"2026-09-01","transport":"walk"}""")
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.candidates.length()").value(1))
            .andExpect(jsonPath("$.candidates[0].places.length()").value(2))
            .andExpect(jsonPath("$.candidates[0].places[0].place_id").value(placeA.id))
            .andExpect(jsonPath("$.candidates[0].places[0].name").value("테스트전용코스생성장소A"))
            .andExpect(jsonPath("$.candidates[0].places[0].visit_order").value(1))
            .andExpect(jsonPath("$.candidates[0].total_duration_min").value(25))

        mockServer.verify()
    }

    @Test
    fun `좋아요한 장소가 부족하면 400을 반환한다`() {
        val owner = user("course_gen_user_2", "kakao-course-gen-2")
        val token = jwtTokenProvider.generateAccessToken(owner.id)
        val placeA = place("COURSEGEN003", "테스트전용코스생성부족장소")
        val session = sessionWithLikedCandidates(owner, listOf(placeA))

        mockMvc.perform(
            post("/courses/generate")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"session_id":"${session.id}","travel_date":"2026-09-01","transport":"walk"}""")
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("NOT_ENOUGH_SWIPE_CANDIDATES"))
    }
}
