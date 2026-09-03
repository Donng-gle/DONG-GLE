package com.dongle.server.auth

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
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper
import java.time.LocalDateTime

// 카카오/구글 OAuth 앱 자격증명이 없어 실제 소셜 로그인은 검증 불가.
// User/RefreshToken을 직접 심어서 JWT 발급 이후 흐름(내 프로필 조회/토큰 갱신/로그아웃)을 검증한다.
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AuthFlowIntegrationTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var refreshTokenRepository: RefreshTokenRepository

    @Autowired
    lateinit var jwtTokenProvider: JwtTokenProvider

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Test
    fun `유효한 액세스 토큰으로 내 프로필을 조회할 수 있다`() {
        val user = userRepository.save(
            User(
                userId = "test_user_1",
                nickname = "테스트유저",
                oauthProvider = OAuthProvider.kakao,
                oauthId = "kakao-id-1",
            )
        )
        val accessToken = jwtTokenProvider.generateAccessToken(user.id)

        mockMvc.perform(get("/users/me").header("Authorization", "Bearer $accessToken"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.nickname").value("테스트유저"))
            .andExpect(jsonPath("$.oauth_provider").value("kakao"))
    }

    @Test
    fun `토큰 없이 내 프로필을 조회하면 401을 반환한다`() {
        mockMvc.perform(get("/users/me"))
            .andExpect(status().isUnauthorized)
    }

    @Test
    fun `유효한 리프레시 토큰으로 액세스 토큰을 재발급받을 수 있다`() {
        val user = userRepository.save(
            User(
                userId = "test_user_2",
                nickname = "테스트유저2",
                oauthProvider = OAuthProvider.google,
                oauthId = "google-id-1",
            )
        )
        val refreshToken = jwtTokenProvider.generateRefreshToken(user.id)
        refreshTokenRepository.save(
            RefreshToken(user = user, token = refreshToken, expiresAt = LocalDateTime.now().plusDays(30))
        )

        mockMvc.perform(
            post("/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"refresh_token":"$refreshToken"}""")
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.access_token").exists())
            .andExpect(jsonPath("$.refresh_token").exists())
            .andExpect(jsonPath("$.refresh_token").value(org.hamcrest.Matchers.not(refreshToken)))
    }

    // 리프레시 토큰 회전(2026-09-04 도입, decision-log 참고) — 한 번 쓴 리프레시 토큰은 즉시 폐기되어
    // 재사용이 안 되고, 응답으로 받은 새 리프레시 토큰만 유효해야 함
    @Test
    fun `리프레시 토큰은 한 번 쓰면 재사용할 수 없고 새로 받은 토큰만 유효하다`() {
        val user = userRepository.save(
            User(
                userId = "test_user_rotation",
                nickname = "테스트유저-회전",
                oauthProvider = OAuthProvider.google,
                oauthId = "google-id-rotation",
            )
        )
        val originalRefreshToken = jwtTokenProvider.generateRefreshToken(user.id)
        refreshTokenRepository.save(
            RefreshToken(user = user, token = originalRefreshToken, expiresAt = LocalDateTime.now().plusDays(30))
        )

        val firstResponse = mockMvc.perform(
            post("/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"refresh_token":"$originalRefreshToken"}""")
        )
            .andExpect(status().isOk)
            .andReturn()
        val newRefreshToken = objectMapper.readTree(firstResponse.response.contentAsString)["refresh_token"].asText()

        // 원래 토큰 재사용 시도 → 이미 폐기되어 실패해야 함
        mockMvc.perform(
            post("/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"refresh_token":"$originalRefreshToken"}""")
        )
            .andExpect(status().isUnauthorized)

        // 새로 받은 토큰은 정상 동작해야 함
        mockMvc.perform(
            post("/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"refresh_token":"$newRefreshToken"}""")
        )
            .andExpect(status().isOk)
    }

    @Test
    fun `로그아웃하면 리프레시 토큰이 무효화된다`() {
        val user = userRepository.save(
            User(
                userId = "test_user_3",
                nickname = "테스트유저3",
                oauthProvider = OAuthProvider.kakao,
                oauthId = "kakao-id-3",
            )
        )
        val accessToken = jwtTokenProvider.generateAccessToken(user.id)
        val refreshToken = jwtTokenProvider.generateRefreshToken(user.id)
        refreshTokenRepository.save(
            RefreshToken(user = user, token = refreshToken, expiresAt = LocalDateTime.now().plusDays(30))
        )

        mockMvc.perform(delete("/auth/logout").header("Authorization", "Bearer $accessToken"))
            .andExpect(status().isNoContent)

        mockMvc.perform(
            post("/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"refresh_token":"$refreshToken"}""")
        )
            .andExpect(status().isUnauthorized)
    }

    @Test
    fun `카카오 리다이렉트 중계는 code 쿼리스트링을 커스텀 스킴으로 그대로 전달한다`() {
        // request.queryString(원문 쿼리스트링)을 그대로 읽어야 해서, MockMvc의 .param()(파싱된 파라미터로만
        // 들어감)이 아니라 URL 자체에 쿼리스트링을 붙여야 실제 브라우저 요청과 동일하게 검증됨
        mockMvc.perform(get("/auth/kakao/callback?code=abc123"))
            .andExpect(status().isFound)
            .andExpect(header().string("Location", "dongle://redirect?code=abc123"))
    }

    @Test
    fun `카카오 리다이렉트 중계는 쿼리스트링이 없어도 커스텀 스킴으로 리다이렉트한다`() {
        mockMvc.perform(get("/auth/kakao/callback"))
            .andExpect(status().isFound)
            .andExpect(header().string("Location", "dongle://redirect"))
    }
}
