package com.dongle.server.user

import com.dongle.server.auth.jwt.JwtTokenProvider
import com.dongle.server.place.LikeService
import com.dongle.server.place.Place
import com.dongle.server.place.PlaceCategory
import com.dongle.server.place.PlaceLikeRepository
import com.dongle.server.place.PlaceRepository
import jakarta.persistence.EntityManager
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class UserWithdrawalApiIntegrationTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var placeRepository: PlaceRepository

    @Autowired
    lateinit var placeLikeRepository: PlaceLikeRepository

    @Autowired
    lateinit var likeService: LikeService

    @Autowired
    lateinit var jwtTokenProvider: JwtTokenProvider

    @Autowired
    lateinit var entityManager: EntityManager

    private fun accessTokenFor(userId: String, oauthId: String): Pair<Long, String> {
        val user = userRepository.save(
            User(userId = userId, nickname = "테스터", oauthProvider = OAuthProvider.kakao, oauthId = oauthId)
        )
        return user.id to jwtTokenProvider.generateAccessToken(user.id)
    }

    @Test
    fun `회원 탈퇴 시 계정과 연관 데이터가 함께 삭제된다`() {
        val (userId, token) = accessTokenFor("withdraw_user_1", "kakao-withdraw-1")
        val place = placeRepository.save(
            Place(
                contentId = "WITHDRAW001",
                contentTypeId = 12,
                category = PlaceCategory.관광지,
                name = "테스트전용탈퇴장소",
                addr1 = "경북 안동시",
                lat = 36.5,
                lng = 128.5,
            )
        )
        likeService.like(userId, place.id)
        assertTrue(placeLikeRepository.existsByUserIdAndPlaceId(userId, place.id))
        // 같은 트랜잭션 안에서 만든 PlaceLike가 영속성 컨텍스트에 남아있으면, 아래 탈퇴 시 Hibernate가
        // "삭제 예정인 User를 참조하는 관리 중 엔티티"로 오인해 flush 시점에 예외를 던짐(DB의
        // ON DELETE CASCADE는 실제로 정상 동작 — 요청마다 새 세션인 운영 환경에선 벌어지지 않는 테스트 전용 문제).
        entityManager.flush()
        entityManager.clear()

        mockMvc.perform(delete("/users/me").header("Authorization", "Bearer $token"))
            .andExpect(status().isNoContent)

        assertFalse(userRepository.existsById(userId))
        assertFalse(placeLikeRepository.existsByUserIdAndPlaceId(userId, place.id))
    }

    @Test
    fun `탈퇴한 계정의 토큰으로 재요청하면 404를 반환한다`() {
        val (_, token) = accessTokenFor("withdraw_user_2", "kakao-withdraw-2")

        mockMvc.perform(delete("/users/me").header("Authorization", "Bearer $token"))
            .andExpect(status().isNoContent)

        mockMvc.perform(get("/users/me").header("Authorization", "Bearer $token"))
            .andExpect(status().isNotFound)
    }

    @Test
    fun `인증 없이 호출하면 401을 반환한다`() {
        mockMvc.perform(delete("/users/me"))
            .andExpect(status().isUnauthorized)
    }
}
