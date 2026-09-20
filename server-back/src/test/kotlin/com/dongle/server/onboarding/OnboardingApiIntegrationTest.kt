package com.dongle.server.onboarding

import com.dongle.server.auth.jwt.JwtTokenProvider
import com.dongle.server.user.OAuthProvider
import com.dongle.server.user.User
import com.dongle.server.user.UserRepository
import org.hamcrest.Matchers.greaterThan
import org.hamcrest.Matchers.lessThan
import org.hamcrest.Matchers.not
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
class OnboardingApiIntegrationTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var onboardingCardRepository: OnboardingCardRepository

    @Autowired
    lateinit var jwtTokenProvider: JwtTokenProvider

    private fun accessTokenFor(userId: String, oauthId: String): String {
        val user = userRepository.save(
            User(userId = userId, nickname = "테스터", oauthProvider = OAuthProvider.kakao, oauthId = oauthId)
        )
        return jwtTokenProvider.generateAccessToken(user.id)
    }

    // Onboarding Algo.md 7장의 하회마을 예시와 동일한 벡터 (좋아요 시 traditional은 오르고 modern은 내려가야 함)
    private fun hahoeCard() = onboardingCardRepository.save(
        OnboardingCard(
            imageUrl = "https://example.com/hahoe.jpg",
            isSeed = true,
            relaxing = 0.85,
            lively = 0.10,
            romantic = 0.30,
            local = 0.60,
            photogenic = 0.75,
            traditional = 0.95,
            modern = 0.05,
        )
    )

    @Test
    fun `감성 태그 7개 목록을 인증 없이 조회할 수 있다`() {
        mockMvc.perform(get("/tags"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.tags.length()").value(7))
            .andExpect(jsonPath("$.tags[0].tag").value("relaxing"))
    }

    @Test
    fun `새 유저는 첫 카드로 시드 카드를 받는다`() {
        hahoeCard()
        val token = accessTokenFor("onboarding_user_1", "kakao-onboarding-1")

        mockMvc.perform(get("/onboarding/next").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.strategy").value("seed"))
    }

    @Test
    fun `카드를 좋아요하면 벡터가 상대적으로 갱신되고 재스와이프는 409를 반환한다`() {
        val card = hahoeCard()
        val token = accessTokenFor("onboarding_user_2", "kakao-onboarding-2")

        mockMvc.perform(
            post("/onboarding/swipe")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"card_id":${card.id},"action":"like"}""")
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.total_seen").value(1))
            .andExpect(jsonPath("$.user_vector.traditional").value(greaterThan(0.6)))
            .andExpect(jsonPath("$.user_vector.modern").value(lessThan(0.4)))

        mockMvc.perform(
            post("/onboarding/swipe")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"card_id":${card.id},"action":"like"}""")
        )
            .andExpect(status().isConflict)
    }

    @Test
    fun `스와이프 응답에 다음 카드가 함께 내려온다`() {
        val first = hahoeCard()
        val token = accessTokenFor("onboarding_user_next", "kakao-onboarding-next")

        mockMvc.perform(
            post("/onboarding/swipe")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"card_id":${first.id},"action":"like"}""")
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.next_card.card.id").isNumber)
            .andExpect(jsonPath("$.next_card.card.id").value(not(first.id.toInt())))
            .andExpect(jsonPath("$.next_card.strategy").value("seed"))
    }

    @Test
    fun `스와이프 후 상태 조회에 진행 정보가 반영된다`() {
        val card = hahoeCard()
        val token = accessTokenFor("onboarding_user_3", "kakao-onboarding-3")

        mockMvc.perform(
            post("/onboarding/swipe")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"card_id":${card.id},"action":"like"}""")
        ).andExpect(status().isOk)

        mockMvc.perform(get("/onboarding/status").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.total_seen").value(1))
            .andExpect(jsonPath("$.like_count").value(1))
            .andExpect(jsonPath("$.dislike_count").value(0))
            .andExpect(jsonPath("$.shown_card_ids[0]").value(card.id))
    }

    @Test
    fun `온보딩을 완료하면 상위 태그 3개를 반환하고 has_onboarded가 true가 된다`() {
        val card = hahoeCard()
        val token = accessTokenFor("onboarding_user_4", "kakao-onboarding-4")

        mockMvc.perform(
            post("/onboarding/swipe")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"card_id":${card.id},"action":"like"}""")
        ).andExpect(status().isOk)

        mockMvc.perform(post("/onboarding/complete").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.top_tags.length()").value(3))
            .andExpect(jsonPath("$.top_tags[0]").value("traditional"))

        mockMvc.perform(get("/users/me").header("Authorization", "Bearer $token"))
            .andExpect(jsonPath("$.has_onboarded").value(true))
    }

    @Test
    fun `재분석 요청 시 벡터가 초기화되고 같은 카드를 다시 스와이프할 수 있다`() {
        val card = hahoeCard()
        val token = accessTokenFor("onboarding_user_5", "kakao-onboarding-5")

        mockMvc.perform(
            post("/onboarding/swipe")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"card_id":${card.id},"action":"like"}""")
        ).andExpect(status().isOk)

        mockMvc.perform(post("/onboarding/reset").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.user_vector.traditional").value(0.5))

        mockMvc.perform(get("/users/me").header("Authorization", "Bearer $token"))
            .andExpect(jsonPath("$.has_onboarded").value(false))

        // 리셋 후엔 스와이프 이력도 지워져서 같은 카드를 다시 스와이프해도 409가 아니어야 함
        mockMvc.perform(
            post("/onboarding/swipe")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"card_id":${card.id},"action":"dislike"}""")
        ).andExpect(status().isOk)
    }

    @Test
    fun `인증 없이 상태를 조회하면 401을 반환한다`() {
        mockMvc.perform(get("/onboarding/status"))
            .andExpect(status().isUnauthorized)
    }
}
