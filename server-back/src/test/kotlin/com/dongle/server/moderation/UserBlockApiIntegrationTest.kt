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
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class UserBlockApiIntegrationTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var jwtTokenProvider: JwtTokenProvider

    private fun newUser(userId: String, oauthId: String, nickname: String = "테스터"): User =
        userRepository.save(User(userId = userId, nickname = nickname, oauthProvider = OAuthProvider.kakao, oauthId = oauthId))

    @Test
    fun `사용자를 차단하고 목록에서 조회할 수 있다`() {
        val me = newUser("block_me_1", "kakao-block-me-1")
        val target = newUser("block_target_1", "kakao-block-target-1", nickname = "차단대상")
        val token = jwtTokenProvider.generateAccessToken(me.id)

        mockMvc.perform(
            post("/users/me/blocks")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"blocked_user_id": ${target.id}}""")
        ).andExpect(status().isNoContent)

        mockMvc.perform(get("/users/me/blocks").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.users[?(@.nickname == '차단대상')]").exists())
    }

    @Test
    fun `자기 자신을 차단하려 하면 400을 반환한다`() {
        val me = newUser("block_me_2", "kakao-block-me-2")
        val token = jwtTokenProvider.generateAccessToken(me.id)

        mockMvc.perform(
            post("/users/me/blocks")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"blocked_user_id": ${me.id}}""")
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("SELF_BLOCK_NOT_ALLOWED"))
    }

    @Test
    fun `이미 차단한 사용자를 다시 차단하면 409를 반환한다`() {
        val me = newUser("block_me_3", "kakao-block-me-3")
        val target = newUser("block_target_3", "kakao-block-target-3")
        val token = jwtTokenProvider.generateAccessToken(me.id)
        val body = """{"blocked_user_id": ${target.id}}"""

        mockMvc.perform(
            post("/users/me/blocks").header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON).content(body)
        ).andExpect(status().isNoContent)

        mockMvc.perform(
            post("/users/me/blocks").header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON).content(body)
        )
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.code").value("USER_ALREADY_BLOCKED"))
    }

    @Test
    fun `차단을 해제할 수 있다`() {
        val me = newUser("block_me_4", "kakao-block-me-4")
        val target = newUser("block_target_4", "kakao-block-target-4")
        val token = jwtTokenProvider.generateAccessToken(me.id)

        mockMvc.perform(
            post("/users/me/blocks").header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON).content("""{"blocked_user_id": ${target.id}}""")
        ).andExpect(status().isNoContent)

        mockMvc.perform(delete("/users/me/blocks/${target.id}").header("Authorization", "Bearer $token"))
            .andExpect(status().isNoContent)
    }

    @Test
    fun `차단 기록이 없는데 해제하려 하면 404를 반환한다`() {
        val me = newUser("block_me_5", "kakao-block-me-5")
        val target = newUser("block_target_5", "kakao-block-target-5")
        val token = jwtTokenProvider.generateAccessToken(me.id)

        mockMvc.perform(delete("/users/me/blocks/${target.id}").header("Authorization", "Bearer $token"))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("USER_BLOCK_NOT_FOUND"))
    }

    @Test
    fun `인증 없이 호출하면 401을 반환한다`() {
        mockMvc.perform(get("/users/me/blocks")).andExpect(status().isUnauthorized)
    }
}
