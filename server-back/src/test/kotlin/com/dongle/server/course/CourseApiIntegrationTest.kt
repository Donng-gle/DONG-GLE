package com.dongle.server.course

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
import com.jayway.jsonpath.JsonPath

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

        mockMvc.perform(get("/courses/$courseId").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.title").value("테스트전용코스"))
            .andExpect(jsonPath("$.places[0].name").value("테스트전용코스장소A"))
            .andExpect(jsonPath("$.places[0].planned_time").value("10:00"))
            .andExpect(jsonPath("$.places[1].name").value("테스트전용코스장소B"))
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
