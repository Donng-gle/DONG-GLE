package com.dongle.server.course

import com.dongle.server.auth.jwt.JwtTokenProvider
import com.dongle.server.course.directions.GoogleRoutesClient
import com.dongle.server.course.directions.RouteLegResult
import com.dongle.server.course.directions.RouteResult
import com.dongle.server.place.Place
import com.dongle.server.place.PlaceCategory
import com.dongle.server.place.PlaceRepository
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
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.annotation.Transactional
import com.jayway.jsonpath.JsonPath

// GoogleRoutesClient를 컴포넌트 단위로 모킹한다 (@MockitoBean) — CourseGenerateApiIntegrationTest 주석 참고
// (RestClient 레이어를 직접 모킹하는 방식은 같은 타입 빈이 여러 개일 때 서로 뒤섞이는 문제가 있었음).
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CourseApiIntegrationTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var placeRepository: PlaceRepository

    @Autowired
    lateinit var jwtTokenProvider: JwtTokenProvider

    @MockitoBean
    lateinit var googleRoutesClient: GoogleRoutesClient

    private fun <T> anyKt(): T = Mockito.any()

    private fun stubDirectionsRoute() {
        val route = RouteResult(
            totalDistanceMeters = 1500,
            totalDurationSeconds = 600,
            legs = listOf(RouteLegResult(distanceMeters = 1500, durationSeconds = 600)),
            encodedPolyline = "abc123",
        )
        given(googleRoutesClient.computeRoute(anyKt(), anyKt())).willReturn(route)
    }

    private fun user(userId: String, oauthId: String): User =
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

    private fun tokenFor(u: User) = jwtTokenProvider.generateAccessToken(u.id)

    @Test
    fun `직접 코스 짜기로 저장하고 상세 조회 시 방문 순서대로 반환된다`() {
        val owner = user("course_user_1", "kakao-course-1")
        val token = tokenFor(owner)
        val placeA = place("CRS001", "테스트전용코스장소A")
        val placeB = place("CRS002", "테스트전용코스장소B")

        val saveResult = mockMvc.perform(
            post("/courses/manual")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"title":"테스트전용코스","places":[
                      {"place_id":${placeB.id},"visit_order":2,"planned_time":"14:00"},
                      {"place_id":${placeA.id},"visit_order":1,"planned_time":"10:00"}
                    ]}
                    """.trimIndent()
                )
        )
            .andExpect(status().isCreated)
            .andReturn()

        val courseId = JsonPath.read<Int>(saveResult.response.contentAsString, "$.course_id")
        stubDirectionsRoute()

        mockMvc.perform(get("/courses/$courseId").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.title").value("테스트전용코스"))
            .andExpect(jsonPath("$.places[0].name").value("테스트전용코스장소A"))
            .andExpect(jsonPath("$.places[0].planned_time").value("10:00"))
            .andExpect(jsonPath("$.places[0].distance_from_prev_km").doesNotExist())
            .andExpect(jsonPath("$.places[1].name").value("테스트전용코스장소B"))
            .andExpect(jsonPath("$.places[1].distance_from_prev_km").value(1.5))
            .andExpect(jsonPath("$.places[1].duration_from_prev_min").value(10))
            .andExpect(jsonPath("$.total_distance_km").value(1.5))
            .andExpect(jsonPath("$.total_duration_min").value(10))
            .andExpect(jsonPath("$.polyline").value("abc123"))
    }

    @Test
    fun `직접 코스 짜기에 end_date를 같이 보내면 여행 기간으로 저장된다`() {
        val owner = user("course_user_range", "kakao-course-range")
        val token = tokenFor(owner)
        val placeA = place("CRS_RANGE1", "테스트전용범위코스장소A")

        val saveResult = mockMvc.perform(
            post("/courses/manual")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """{"title":"테스트전용범위코스","travel_date":"2026-08-02","end_date":"2026-08-05",
                       "places":[{"place_id":${placeA.id},"visit_order":1}]}""",
                )
        )
            .andExpect(status().isCreated)
            .andReturn()

        val courseId = JsonPath.read<Int>(saveResult.response.contentAsString, "$.course_id")
        stubDirectionsRoute()

        mockMvc.perform(get("/courses/$courseId").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.travel_date").value("2026-08-02"))
            .andExpect(jsonPath("$.end_date").value("2026-08-05"))
    }

    @Test
    fun `end_date가 travel_date보다 이전이면 400을 반환한다`() {
        val owner = user("course_user_range_invalid", "kakao-course-range-invalid")
        val token = tokenFor(owner)
        val placeA = place("CRS_RANGE2", "테스트전용범위코스장소B")

        mockMvc.perform(
            post("/courses/manual")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """{"title":"테스트전용잘못된범위코스","travel_date":"2026-08-05","end_date":"2026-08-02",
                       "places":[{"place_id":${placeA.id},"visit_order":1}]}""",
                )
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("INVALID_COURSE_DATE_RANGE"))
    }

    @Test
    fun `AI 후보 저장 방식(POST courses)으로도 저장할 수 있다`() {
        val owner = user("course_user_2", "kakao-course-2")
        val token = tokenFor(owner)
        val placeA = place("CRS003", "테스트전용코스장소C")

        mockMvc.perform(
            post("/courses")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"title":"AI코스저장","source":"user","places":[{"place_id":${placeA.id},"visit_order":1}]}""")
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.course_id").exists())
    }

    @Test
    fun `내 코스 목록에서 저장한 코스를 확인할 수 있다`() {
        val owner = user("course_user_3", "kakao-course-3")
        val token = tokenFor(owner)
        val placeA = place("CRS004", "테스트전용코스장소D")

        mockMvc.perform(
            post("/courses/manual")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"title":"테스트전용목록코스","places":[{"place_id":${placeA.id},"visit_order":1}]}""")
        ).andExpect(status().isCreated)

        mockMvc.perform(get("/users/me/courses").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.courses[?(@.title == '테스트전용목록코스')]").exists())
    }

    @Test
    fun `코스 목록의 장소 썸네일은 방문 순서 기준 최대 3장만 온다`() {
        val owner = user("course_user_thumb", "kakao-course-thumb")
        val token = tokenFor(owner)
        // 일부러 뒤죽박죽 순서로 저장 요청 — 응답은 visit_order 기준으로 정렬돼야 함
        val places = (1..4).map { place("CRS_THUMB00$it", "테스트전용썸네일장소$it") }

        mockMvc.perform(
            post("/courses/manual")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"title":"테스트전용썸네일코스","places":[
                      {"place_id":${places[3].id},"visit_order":4},
                      {"place_id":${places[0].id},"visit_order":1},
                      {"place_id":${places[2].id},"visit_order":3},
                      {"place_id":${places[1].id},"visit_order":2}
                    ]}
                    """.trimIndent()
                )
        ).andExpect(status().isCreated)

        val listResult = mockMvc.perform(get("/users/me/courses").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andReturn()

        // 필터 경로([?(...)]) 뒤에 추가 필드/인덱스를 이어붙이면 Jayway가 중첩 배열을 돌려줘서 캐스팅이
        // 꼬임 — courses 전체를 Map 리스트로 받아서 코틀린에서 직접 찾는 쪽이 훨씬 안전함
        val courses = JsonPath.read<List<Map<String, Any?>>>(listResult.response.contentAsString, "$.courses")
        val target = courses.first { it["title"] == "테스트전용썸네일코스" }
        val placeCount = target["place_count"]
        @Suppress("UNCHECKED_CAST")
        val thumbnails = target["place_thumbnails"] as List<String>

        assert(placeCount == 4) { "place_count expected 4 but was $placeCount" }
        assert(thumbnails.size == 3) { "place_thumbnails expected 3 items but was $thumbnails" }
        assert(thumbnails == listOf("https://example.com/CRS_THUMB001.jpg", "https://example.com/CRS_THUMB002.jpg", "https://example.com/CRS_THUMB003.jpg")) {
            "place_thumbnails expected in visit order but was $thumbnails"
        }
    }

    @Test
    fun `코스를 수정하면 제목과 장소 구성이 바뀐다`() {
        val owner = user("course_user_4", "kakao-course-4")
        val token = tokenFor(owner)
        val placeA = place("CRS005", "테스트전용코스장소E")
        val placeB = place("CRS006", "테스트전용코스장소F")

        val saveResult = mockMvc.perform(
            post("/courses/manual")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"title":"수정전","places":[{"place_id":${placeA.id},"visit_order":1}]}""")
        ).andReturn()
        val courseId = JsonPath.read<Int>(saveResult.response.contentAsString, "$.course_id")

        mockMvc.perform(
            patch("/courses/$courseId")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"title":"수정후","source":"user","places":[{"place_id":${placeB.id},"visit_order":1}]}""")
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.title").value("수정후"))
            .andExpect(jsonPath("$.places.length()").value(1))
            .andExpect(jsonPath("$.places[0].name").value("테스트전용코스장소F"))
    }

    @Test
    fun `코스를 삭제하면 이후 조회 시 404를 반환한다`() {
        val owner = user("course_user_5", "kakao-course-5")
        val token = tokenFor(owner)
        val placeA = place("CRS007", "테스트전용코스장소G")

        val saveResult = mockMvc.perform(
            post("/courses/manual")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"title":"삭제될코스","places":[{"place_id":${placeA.id},"visit_order":1}]}""")
        ).andReturn()
        val courseId = JsonPath.read<Int>(saveResult.response.contentAsString, "$.course_id")

        mockMvc.perform(delete("/courses/$courseId").header("Authorization", "Bearer $token"))
            .andExpect(status().isNoContent)

        mockMvc.perform(get("/courses/$courseId").header("Authorization", "Bearer $token"))
            .andExpect(status().isNotFound)
    }

    @Test
    fun `다른 사용자의 코스에 접근하면 403을 반환한다`() {
        val owner = user("course_user_6", "kakao-course-6")
        val stranger = user("course_user_7", "kakao-course-7")
        val ownerToken = tokenFor(owner)
        val strangerToken = tokenFor(stranger)
        val placeA = place("CRS008", "테스트전용코스장소H")

        val saveResult = mockMvc.perform(
            post("/courses/manual")
                .header("Authorization", "Bearer $ownerToken")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"title":"남의코스","places":[{"place_id":${placeA.id},"visit_order":1}]}""")
        ).andReturn()
        val courseId = JsonPath.read<Int>(saveResult.response.contentAsString, "$.course_id")

        mockMvc.perform(get("/courses/$courseId").header("Authorization", "Bearer $strangerToken"))
            .andExpect(status().isForbidden)
    }

    @Test
    fun `존재하지 않는 코스를 조회하면 404를 반환한다`() {
        val owner = user("course_user_8", "kakao-course-8")
        val token = tokenFor(owner)

        mockMvc.perform(get("/courses/999999999").header("Authorization", "Bearer $token"))
            .andExpect(status().isNotFound)
    }

    @Test
    fun `인증 없이 코스를 저장하면 401을 반환한다`() {
        mockMvc.perform(
            post("/courses/manual")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"title":"무인증","places":[{"place_id":1,"visit_order":1}]}""")
        )
            .andExpect(status().isUnauthorized)
    }
}
