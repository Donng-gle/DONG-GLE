package com.dongle.server.moderation

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
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ReportApiIntegrationTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var jwtTokenProvider: JwtTokenProvider

    private fun newUser(userId: String, oauthId: String): User =
        userRepository.save(User(userId = userId, nickname = "테스터", oauthProvider = OAuthProvider.kakao, oauthId = oauthId))

    @Test
    fun `방문 기록을 신고하면 pending 상태로 접수된다`() {
        val reporter = newUser("report_user_1", "kakao-report-1")
        val token = jwtTokenProvider.generateAccessToken(reporter.id)

        mockMvc.perform(
            post("/reports")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"target_type": "visit_log", "target_id": 999, "reason": "spam"}""")
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.status").value("pending"))
            .andExpect(jsonPath("$.reason").value("spam"))
            .andExpect(jsonPath("$.target_type").value("visit_log"))

        mockMvc.perform(get("/reports").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.reports[?(@.target_id == 999)]").exists())
    }

    @Test
    fun `잘못된 reason 값이면 400을 반환한다`() {
        val reporter = newUser("report_user_2", "kakao-report-2")
        val token = jwtTokenProvider.generateAccessToken(reporter.id)

        mockMvc.perform(
            post("/reports")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"target_type": "visit_log", "target_id": 1, "reason": "not_a_real_reason"}""")
        ).andExpect(status().isBadRequest)
    }

    @Test
    fun `인증 없이 호출하면 401을 반환한다`() {
        mockMvc.perform(get("/reports")).andExpect(status().isUnauthorized)
    }
}
