package com.dongle.server.course

import com.dongle.server.auth.jwt.JwtTokenProvider
import com.dongle.server.course.directions.GoogleRoutesClient
import com.dongle.server.course.directions.RouteLegResult
import com.dongle.server.course.directions.RouteResult
import com.dongle.server.course.optimizer.CourseOptimizationResult
import com.dongle.server.course.optimizer.CourseOptimizerClient
import com.dongle.server.course.optimizer.RouteScoreBreakdown
import com.dongle.server.course.optimizer.ScoredRoute
import com.dongle.server.course.optimizer.VisitStop
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
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime

// CourseOptimizerClient/GoogleRoutesClient 둘 다를 컴포넌트 단위로 모킹한다 (@MockitoBean).
// 처음엔 RestClient 레이어를 MockRestServiceServer로 가로채는 방식(SwipeApiIntegrationTest 참고)을
// 썼으나, 같은 RestClient 타입 빈이 여러 개인 상태에서 한 테스트가 둘 이상을 동시에 교체하면
// @Primary 하나가 전부를 이겨버려 서로 뒤섞이는 문제가 실제로 발생함(2026-08-30). 이 클라이언트들은
// 각자 별개 타입(@Component)이라 @MockitoBean으로 바로 교체하면 그 문제 자체가 생기지 않음 —
// 요청/응답의 실제 HTTP 계약 검증은 CourseOptimizerClientTest/GoogleRoutesClientTest(단위 테스트)가 이미 커버.
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

    @MockitoBean
    lateinit var courseOptimizerClient: CourseOptimizerClient

    @MockitoBean
    lateinit var googleRoutesClient: GoogleRoutesClient

    private fun <T> anyKt(): T = Mockito.any()

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

    private fun stubOptimize(vararg placeIds: Long) {
        val stops = placeIds.map { id ->
            VisitStop(
                placeId = id.toString(),
                arrivalTime = LocalDateTime.of(2026, 9, 1, 9, 30),
                visitStartTime = LocalDateTime.of(2026, 9, 1, 9, 30),
                departureTime = LocalDateTime.of(2026, 9, 1, 10, 30),
                actualStayMinutes = 60,
            )
        }
        val result = CourseOptimizationResult(
            selectedRoute = ScoredRoute(
                stops = stops,
                score = RouteScoreBreakdown(
                    timeScore = 0.8,
                    transitionScore = 0.7,
                    balanceScore = 0.6,
                    experienceScore = 0.75,
                    totalTravelMinutes = 25,
                    travelScore = 0.9,
                    totalScore = 0.82,
                ),
            ),
            candidateRouteCount = 1,
            evaluatedRouteCount = 1,
            targetVisitCount = placeIds.size,
            freeTimeMinutes = 30,
            promptVersion = "course-eval-v1",
            modelName = "gpt-4.1-mini",
        )
        given(courseOptimizerClient.optimizeCourse(anyKt())).willReturn(result)
    }

    // stubOptimize와 같은 값을 돌려주면서, 실제로 CourseOptimizerClient에 어떤 TripInput이 넘어갔는지
    // 확인하고 싶을 때 씀(시작/종료 시간이 그대로 전달되는지 검증 등) — Mockito ArgumentCaptor.capture()는
    // 코틀린 non-null 파라미터랑 같이 쓰면 NPE가 나서(anyKt()가 필요한 것과 같은 이유) 대신 willAnswer
    // 람다로 직접 받아서 배열에 담아 반환함(2026-09-09)
    private fun stubOptimizeCapturing(vararg placeIds: Long): Array<com.dongle.server.course.optimizer.TripInput?> {
        val captured = arrayOfNulls<com.dongle.server.course.optimizer.TripInput>(1)
        val stops = placeIds.map { id ->
            VisitStop(
                placeId = id.toString(),
                arrivalTime = LocalDateTime.of(2026, 9, 1, 9, 30),
                visitStartTime = LocalDateTime.of(2026, 9, 1, 9, 30),
                departureTime = LocalDateTime.of(2026, 9, 1, 10, 30),
                actualStayMinutes = 60,
            )
        }
        val result = CourseOptimizationResult(
            selectedRoute = ScoredRoute(
                stops = stops,
                score = RouteScoreBreakdown(
                    timeScore = 0.8,
                    transitionScore = 0.7,
                    balanceScore = 0.6,
                    experienceScore = 0.75,
                    totalTravelMinutes = 25,
                    travelScore = 0.9,
                    totalScore = 0.82,
                ),
            ),
            candidateRouteCount = 1,
            evaluatedRouteCount = 1,
            targetVisitCount = placeIds.size,
            freeTimeMinutes = 30,
            promptVersion = "course-eval-v1",
            modelName = "gpt-4.1-mini",
        )
        given(courseOptimizerClient.optimizeCourse(anyKt())).willAnswer { invocation ->
            captured[0] = invocation.getArgument(0)
            result
        }
        return captured
    }

    private fun stubDirectionsRoute() {
        val route = RouteResult(
            totalDistanceMeters = 2000,
            totalDurationSeconds = 1200,
            legs = listOf(RouteLegResult(distanceMeters = 2000, durationSeconds = 1200)),
            encodedPolyline = "gen-poly",
        )
        given(googleRoutesClient.computeRoute(anyKt(), anyKt())).willReturn(route)
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
        stubOptimize(placeA.id, placeB.id)
        stubDirectionsRoute()

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
            .andExpect(jsonPath("$.candidates[0].places[1].distance_from_prev_km").value(2.0))
            .andExpect(jsonPath("$.candidates[0].places[1].duration_from_prev_min").value(20))
            .andExpect(jsonPath("$.candidates[0].total_distance_km").value(2.0))
            // Directions 응답(1200s=20분)이 course_optimizer 자체 산출값(25분)보다 우선함 (2026-08-30 변경)
            .andExpect(jsonPath("$.candidates[0].total_duration_min").value(20))
    }

    @Test
    fun `시작-종료 시간을 지정하면 course_optimizer에 그대로 전달된다`() {
        val owner = user("course_gen_user_3", "kakao-course-gen-3")
        val token = jwtTokenProvider.generateAccessToken(owner.id)
        val placeA = place("COURSEGEN004", "테스트전용코스생성장소C")
        val placeB = place("COURSEGEN005", "테스트전용코스생성장소D")
        semanticVector(placeA.id)
        semanticVector(placeB.id)
        val session = sessionWithLikedCandidates(owner, listOf(placeA, placeB))
        val captured = stubOptimizeCapturing(placeA.id, placeB.id)
        stubDirectionsRoute()

        mockMvc.perform(
            post("/courses/generate")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """{"session_id":"${session.id}","travel_date":"2026-09-01","transport":"walk",""" +
                        """"start_time":"10:30","end_time":"18:00"}"""
                )
        )
            .andExpect(status().isOk)

        assert(captured[0]?.startTime == LocalDateTime.of(2026, 9, 1, 10, 30))
        assert(captured[0]?.endTime == LocalDateTime.of(2026, 9, 1, 18, 0))
    }

    @Test
    fun `종료 시간이 시작 시간보다 이르면 400을 반환한다`() {
        val owner = user("course_gen_user_4", "kakao-course-gen-4")
        val token = jwtTokenProvider.generateAccessToken(owner.id)
        val placeA = place("COURSEGEN006", "테스트전용코스생성장소E")
        val placeB = place("COURSEGEN007", "테스트전용코스생성장소F")
        semanticVector(placeA.id)
        semanticVector(placeB.id)
        val session = sessionWithLikedCandidates(owner, listOf(placeA, placeB))

        mockMvc.perform(
            post("/courses/generate")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """{"session_id":"${session.id}","travel_date":"2026-09-01","transport":"walk",""" +
                        """"start_time":"18:00","end_time":"10:30"}"""
                )
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("INVALID_COURSE_TIME_RANGE"))
    }

    @Test
    fun `end_date를 주면 날짜마다 course_optimizer를 따로 호출해 장소가 겹치지 않게 나눈다`() {
        val owner = user("course_gen_user_5", "kakao-course-gen-5")
        val token = jwtTokenProvider.generateAccessToken(owner.id)
        val placeA = place("COURSEGEN008", "테스트전용코스생성장소G")
        val placeB = place("COURSEGEN009", "테스트전용코스생성장소H")
        val placeC = place("COURSEGEN010", "테스트전용코스생성장소I")
        val placeD = place("COURSEGEN011", "테스트전용코스생성장소J")
        listOf(placeA, placeB, placeC, placeD).forEach { semanticVector(it.id) }
        val session = sessionWithLikedCandidates(owner, listOf(placeA, placeB, placeC, placeD))
        // 매 호출마다 그 시점 후보 풀의 앞 2개만 골라서 돌려줌 — 실제 course_optimizer가 날짜별로
        // 다른(중복 없는) 장소를 고르는 상황을 흉내냄. 이전 날에 뽑힌 장소는 CourseService가 다음
        // 호출 전에 풀에서 미리 빼므로, 이 스텁은 그냥 "받은 후보 중 앞 2개"만 고르면 됨
        given(courseOptimizerClient.optimizeCourse(anyKt())).willAnswer { invocation ->
            val input = invocation.getArgument<com.dongle.server.course.optimizer.TripInput>(0)
            val picked = input.candidates.take(2)
            CourseOptimizationResult(
                selectedRoute = ScoredRoute(
                    stops = picked.map { c ->
                        VisitStop(
                            placeId = c.placeId,
                            arrivalTime = input.startTime,
                            visitStartTime = input.startTime,
                            departureTime = input.startTime.plusHours(1),
                            actualStayMinutes = 60,
                        )
                    },
                    score = RouteScoreBreakdown(
                        timeScore = 0.8,
                        transitionScore = 0.7,
                        balanceScore = 0.6,
                        experienceScore = 0.75,
                        totalTravelMinutes = 25,
                        travelScore = 0.9,
                        totalScore = 0.82,
                    ),
                ),
                candidateRouteCount = 1,
                evaluatedRouteCount = 1,
                targetVisitCount = picked.size,
                freeTimeMinutes = 30,
                promptVersion = "course-eval-v1",
                modelName = "gpt-4.1-mini",
            )
        }
        stubDirectionsRoute()

        mockMvc.perform(
            post("/courses/generate")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """{"session_id":"${session.id}","travel_date":"2026-09-01","end_date":"2026-09-02",""" +
                        """"transport":"walk"}"""
                )
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.candidates[0].title").value("안동 1박 2일 코스"))
            .andExpect(jsonPath("$.candidates[0].places.length()").value(4))
            .andExpect(jsonPath("$.candidates[0].places[0].visit_date").value("2026-09-01"))
            .andExpect(jsonPath("$.candidates[0].places[1].visit_date").value("2026-09-01"))
            .andExpect(jsonPath("$.candidates[0].places[2].visit_date").value("2026-09-02"))
            .andExpect(jsonPath("$.candidates[0].places[3].visit_date").value("2026-09-02"))
            // visit_order는 날짜와 무관하게 코스 전체에서 계속 이어짐(직접 코스 만들기와 동일 컨벤션)
            .andExpect(jsonPath("$.candidates[0].places[0].visit_order").value(1))
            .andExpect(jsonPath("$.candidates[0].places[3].visit_order").value(4))
            // 이틀치 장소 4곳이 서로 겹치지 않아야 함
            .andExpect(
                jsonPath("$.candidates[0].places[*].place_id").value(
                    org.hamcrest.Matchers.containsInAnyOrder(
                        placeA.id.toInt(), placeB.id.toInt(), placeC.id.toInt(), placeD.id.toInt()
                    )
                )
            )
    }

    @Test
    fun `날짜 범위 안에서 좋아요한 장소가 먼저 소진되면 그만큼만 생성한다`() {
        val owner = user("course_gen_user_6", "kakao-course-gen-6")
        val token = jwtTokenProvider.generateAccessToken(owner.id)
        val placeA = place("COURSEGEN012", "테스트전용코스생성장소K")
        val placeB = place("COURSEGEN013", "테스트전용코스생성장소L")
        semanticVector(placeA.id)
        semanticVector(placeB.id)
        // 좋아요한 장소가 2곳뿐이라 하루치(2곳)를 다 쓰면 다음 날엔 후보가 0개 남음 —
        // 3일 범위를 요청해도 첫째 날만 생성되고 나머지 날은 생략돼야 함(200으로는 응답)
        val session = sessionWithLikedCandidates(owner, listOf(placeA, placeB))
        stubOptimize(placeA.id, placeB.id)
        stubDirectionsRoute()

        mockMvc.perform(
            post("/courses/generate")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """{"session_id":"${session.id}","travel_date":"2026-09-01","end_date":"2026-09-03",""" +
                        """"transport":"walk"}"""
                )
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.candidates[0].places.length()").value(2))
            .andExpect(jsonPath("$.candidates[0].places[0].visit_date").value("2026-09-01"))
            .andExpect(jsonPath("$.candidates[0].places[1].visit_date").value("2026-09-01"))
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
