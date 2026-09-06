package com.dongle.server.explore

import com.dongle.server.auth.jwt.JwtTokenProvider
import com.dongle.server.course.Course
import com.dongle.server.course.CoursePlace
import com.dongle.server.course.CourseRepository
import com.dongle.server.course.CourseSource
import com.dongle.server.place.Place
import com.dongle.server.place.PlaceCategory
import com.dongle.server.place.PlaceRepository
import com.dongle.server.user.OAuthProvider
import com.dongle.server.user.User
import com.dongle.server.user.UserPreference
import com.dongle.server.user.UserPreferenceRepository
import com.dongle.server.user.UserRepository
import com.dongle.server.visitlog.LogEmotionTag
import com.dongle.server.visitlog.VisitLog
import com.dongle.server.visitlog.VisitLogPhoto
import com.dongle.server.visitlog.VisitLogRepository
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ExploreApiIntegrationTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var userPreferenceRepository: UserPreferenceRepository

    @Autowired
    lateinit var placeRepository: PlaceRepository

    @Autowired
    lateinit var visitLogRepository: VisitLogRepository

    @Autowired
    lateinit var courseRepository: CourseRepository

    @Autowired
    lateinit var jwtTokenProvider: JwtTokenProvider

    private fun user(userId: String, oauthId: String) =
        userRepository.save(User(userId = userId, nickname = "테스터", oauthProvider = OAuthProvider.kakao, oauthId = oauthId))

    private fun preference(user: User, tag: String, score: Double) =
        userPreferenceRepository.save(UserPreference(user = user, tag = tag, score = score))

    private fun place(contentId: String, name: String) = placeRepository.save(
        Place(
            contentId = contentId,
            contentTypeId = 12,
            category = PlaceCategory.관광지,
            name = name,
            addr1 = "경북 안동시",
            lat = 36.5389,
            lng = 128.5169,
        )
    )

    private fun publicLog(user: User, place: Place, oneLine: String, tag: String): VisitLog {
        val saved = visitLogRepository.save(VisitLog(user = user, place = place, oneLine = oneLine, isPublic = true))
        saved.emotionTags.add(LogEmotionTag(visitLog = saved, tag = tag, score = 0.8))
        // 사진별 캡션(2026-09-07 결정, decision-log 참고) — "취향 맞춤 코스" 카드가 사진을 넘기면
        // 이 캡션으로 바뀌어야 해서 explore 응답에 캡션까지 실려오는지 검증용으로 추가
        saved.photos.add(VisitLogPhoto(visitLog = saved, photoUrl = "https://example.com/${place.contentId}.jpg", caption = "테스트전용캡션-${place.contentId}", sortOrder = 0))
        return visitLogRepository.save(saved)
    }

    @Test
    fun `취향이 비슷한 유저의 공개 기록만 반환한다`() {
        val me = user("explore_user_1", "kakao-explore-1")
        val token = jwtTokenProvider.generateAccessToken(me.id)
        preference(me, "relaxing", 0.9)

        val similarUser = user("explore_user_2", "kakao-explore-2")
        preference(similarUser, "relaxing", 0.85)
        val similarPlace = place("EXP001", "테스트전용탐색장소-유사")
        publicLog(similarUser, similarPlace, "테스트전용탐색리뷰-유사", "relaxing")

        val dissimilarUser = user("explore_user_3", "kakao-explore-3")
        preference(dissimilarUser, "modern", 0.9)
        val dissimilarPlace = place("EXP002", "테스트전용탐색장소-비유사")
        publicLog(dissimilarUser, dissimilarPlace, "테스트전용탐색리뷰-비유사", "modern")

        mockMvc.perform(get("/explore/similar-logs").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.logs[?(@.one_line == '테스트전용탐색리뷰-유사')]").exists())
            .andExpect(jsonPath("$.logs[?(@.one_line == '테스트전용탐색리뷰-비유사')]").doesNotExist())
            .andExpect(jsonPath("$.logs[0].nickname").value("테스터"))
            .andExpect(jsonPath("$.logs[0].photos[0].url").value("https://example.com/EXP001.jpg"))
            .andExpect(jsonPath("$.logs[0].photos[0].caption").value("테스트전용캡션-EXP001"))
    }

    @Test
    fun `내 취향 데이터가 없으면 빈 목록을 반환한다`() {
        val me = user("explore_user_4", "kakao-explore-4")
        val token = jwtTokenProvider.generateAccessToken(me.id)

        mockMvc.perform(get("/explore/similar-logs").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.logs.length()").value(0))
    }

    @Test
    fun `인증 없이 호출하면 401을 반환한다`() {
        mockMvc.perform(get("/explore/similar-logs"))
            .andExpect(status().isUnauthorized)
    }

    private fun publicCourse(user: User, title: String, places: List<Place>): Course {
        val saved = courseRepository.save(Course(user = user, title = title, source = CourseSource.user, isPublic = true))
        places.forEachIndexed { index, place ->
            saved.places.add(CoursePlace(course = saved, place = place, visitOrder = index + 1))
        }
        return courseRepository.save(saved)
    }

    // "취향 맞춤 코스" 탭 카드 목록(2026-09-07 결정, decision-log 참고) — similar-logs와 동일한
    // 취향 겹침 판단을 코스에도 그대로 적용
    @Test
    fun `취향이 비슷한 유저의 공개 코스만 반환한다`() {
        val me = user("explore_course_user_1", "kakao-explore-course-1")
        val token = jwtTokenProvider.generateAccessToken(me.id)
        preference(me, "relaxing", 0.9)

        val similarUser = user("explore_course_user_2", "kakao-explore-course-2")
        preference(similarUser, "relaxing", 0.85)
        val similarPlace = place("EXPC001", "테스트전용탐색코스장소-유사")
        publicCourse(similarUser, "테스트전용탐색코스-유사", listOf(similarPlace))

        val dissimilarUser = user("explore_course_user_3", "kakao-explore-course-3")
        preference(dissimilarUser, "modern", 0.9)
        val dissimilarPlace = place("EXPC002", "테스트전용탐색코스장소-비유사")
        val privatePlace = place("EXPC003", "테스트전용비공개코스장소")
        publicCourse(dissimilarUser, "테스트전용탐색코스-비유사", listOf(dissimilarPlace))
        val privateCourse = publicCourse(similarUser, "테스트전용비공개코스", listOf(privatePlace))
        privateCourse.isPublic = false
        courseRepository.save(privateCourse)

        mockMvc.perform(get("/explore/similar-courses").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.courses[?(@.title == '테스트전용탐색코스-유사')]").exists())
            .andExpect(jsonPath("$.courses[?(@.title == '테스트전용탐색코스-비유사')]").doesNotExist())
            .andExpect(jsonPath("$.courses[?(@.title == '테스트전용비공개코스')]").doesNotExist())
            .andExpect(jsonPath("$.courses[0].nickname").value("테스터"))
            .andExpect(jsonPath("$.courses[0].place_count").value(1))
            .andExpect(jsonPath("$.courses[0].place_previews[0].name").value("테스트전용탐색코스장소-유사"))
    }
}
