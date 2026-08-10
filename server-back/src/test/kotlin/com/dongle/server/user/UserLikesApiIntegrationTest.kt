package com.dongle.server.user

import com.dongle.server.auth.jwt.JwtTokenProvider
import com.dongle.server.place.Place
import com.dongle.server.place.PlaceCategory
import com.dongle.server.place.PlaceLike
import com.dongle.server.place.PlaceLikeRepository
import com.dongle.server.place.PlaceRepository
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
class UserLikesApiIntegrationTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var placeRepository: PlaceRepository

    @Autowired
    lateinit var placeLikeRepository: PlaceLikeRepository

    @Autowired
    lateinit var jwtTokenProvider: JwtTokenProvider

    private fun accessTokenFor(userId: String, oauthId: String): User {
        return userRepository.save(
            User(userId = userId, nickname = "테스터", oauthProvider = OAuthProvider.kakao, oauthId = oauthId)
        )
    }

    @Test
    fun `내가 좋아요한 장소 목록을 조회할 수 있다`() {
        val user = accessTokenFor("mylikes_user_1", "kakao-mylikes-1")
        val token = jwtTokenProvider.generateAccessToken(user.id)
        val place = placeRepository.save(
            Place(
                contentId = "MYLIKE001",
                contentTypeId = 12,
                category = PlaceCategory.관광지,
                name = "테스트전용좋아요장소",
                addr1 = "경북 안동시",
                lat = 36.5389,
                lng = 128.5169,
            )
        )
        placeLikeRepository.save(PlaceLike(user = user, place = place))

        mockMvc.perform(get("/users/me/likes").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.places[?(@.name == '테스트전용좋아요장소')]").exists())
    }

    @Test
    fun `인증 없이 호출하면 401을 반환한다`() {
        mockMvc.perform(get("/users/me/likes"))
            .andExpect(status().isUnauthorized)
    }
}
