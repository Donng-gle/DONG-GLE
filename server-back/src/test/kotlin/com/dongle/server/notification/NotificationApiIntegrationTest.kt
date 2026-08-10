package com.dongle.server.notification

import com.dongle.server.auth.jwt.JwtTokenProvider
import com.dongle.server.user.OAuthProvider
import com.dongle.server.user.User
import com.dongle.server.user.UserRepository
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class NotificationApiIntegrationTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var jwtTokenProvider: JwtTokenProvider

    private fun tokenFor(userId: String, oauthId: String): String {
        val user = userRepository.save(
            User(userId = userId, nickname = "테스터", oauthProvider = OAuthProvider.kakao, oauthId = oauthId)
        )
        return jwtTokenProvider.generateAccessToken(user.id)
    }

    @Test
    fun `알림 설정을 조회하면 기본값이 생성되어 반환된다`() {
        val token = tokenFor("notif_user_1", "kakao-notif-1")

        mockMvc.perform(get("/users/me/notification").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.push_enabled").value(false))
            .andExpect(jsonPath("$.event_alert").value(true))
            .andExpect(jsonPath("$.course_reminder").value(true))
    }

    @Test
    fun `알림 설정을 수정하면 반영된다`() {
        val token = tokenFor("notif_user_2", "kakao-notif-2")

        mockMvc.perform(
            patch("/users/me/notification")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"push_enabled":true,"event_alert":false,"course_reminder":true}""")
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.push_enabled").value(true))
            .andExpect(jsonPath("$.event_alert").value(false))

        mockMvc.perform(get("/users/me/notification").header("Authorization", "Bearer $token"))
            .andExpect(jsonPath("$.push_enabled").value(true))
    }

    @Test
    fun `디바이스 토큰을 등록할 수 있고 같은 플랫폼이면 최신 토큰으로 덮어쓴다`() {
        val token = tokenFor("notif_user_3", "kakao-notif-3")

        mockMvc.perform(
            post("/users/me/device-token")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"fcm_token":"token-A","platform":"ios"}""")
        ).andExpect(status().isNoContent)

        mockMvc.perform(
            post("/users/me/device-token")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"fcm_token":"token-B","platform":"ios"}""")
        ).andExpect(status().isNoContent)
    }

    @Test
    fun `인증 없이 호출하면 401을 반환한다`() {
        mockMvc.perform(get("/users/me/notification"))
            .andExpect(status().isUnauthorized)
    }
}
