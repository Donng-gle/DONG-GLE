package com.dongle.server.user

import com.dongle.server.auth.jwt.JwtTokenProvider
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
class UserPreferencesApiIntegrationTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var userPreferenceRepository: UserPreferenceRepository

    @Autowired
    lateinit var jwtTokenProvider: JwtTokenProvider

    private fun accessTokenFor(userId: String, oauthId: String): Pair<Long, String> {
        val user = userRepository.save(
            User(userId = userId, nickname = "테스터", oauthProvider = OAuthProvider.kakao, oauthId = oauthId)
        )
        return user.id to jwtTokenProvider.generateAccessToken(user.id)
    }

    @Test
    fun `내 취향 태그 점수를 조회할 수 있다`() {
        val (userId, token) = accessTokenFor("pref_user_1", "kakao-pref-1")
        userPreferenceRepository.save(
            UserPreference(user = userRepository.getReferenceById(userId), tag = "relaxing", score = 4.2)
        )

        mockMvc.perform(get("/users/me/preferences").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.preferences[?(@.tag == 'relaxing')].score").value(4.2))
    }

    @Test
    fun `인증 없이 호출하면 401을 반환한다`() {
        mockMvc.perform(get("/users/me/preferences"))
            .andExpect(status().isUnauthorized)
    }
}
