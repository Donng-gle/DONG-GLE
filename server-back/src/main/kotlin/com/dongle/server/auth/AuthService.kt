package com.dongle.server.auth

import com.dongle.server.auth.dto.OAuthLoginResponse
import com.dongle.server.auth.dto.RefreshResponse
import com.dongle.server.auth.jwt.JwtTokenProvider
import com.dongle.server.auth.oauth.GoogleOAuthClient
import com.dongle.server.auth.oauth.KakaoOAuthClient
import com.dongle.server.auth.oauth.OAuthUserInfo
import com.dongle.server.common.config.JwtProperties
import com.dongle.server.user.OAuthProvider
import com.dongle.server.user.User
import com.dongle.server.user.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Service
@Transactional
class AuthService(
    private val userRepository: UserRepository,
    private val refreshTokenRepository: RefreshTokenRepository,
    private val kakaoOAuthClient: KakaoOAuthClient,
    private val googleOAuthClient: GoogleOAuthClient,
    private val jwtTokenProvider: JwtTokenProvider,
    private val jwtProperties: JwtProperties,
) {
    fun loginWithKakao(code: String): OAuthLoginResponse =
        login(OAuthProvider.kakao, kakaoOAuthClient.getUserInfo(code))

    fun loginWithGoogle(code: String): OAuthLoginResponse =
        login(OAuthProvider.google, googleOAuthClient.getUserInfo(code))

    fun refresh(refreshToken: String): RefreshResponse {
        if (!jwtTokenProvider.validate(refreshToken)) throw InvalidRefreshTokenException()

        val stored = refreshTokenRepository.findByToken(refreshToken)
            ?: throw InvalidRefreshTokenException()
        if (stored.expiresAt.isBefore(LocalDateTime.now())) throw InvalidRefreshTokenException()

        return RefreshResponse(jwtTokenProvider.generateAccessToken(stored.user.id))
    }

    fun logout(userId: Long) {
        refreshTokenRepository.deleteAllByUserId(userId)
    }

    private fun login(provider: OAuthProvider, info: OAuthUserInfo): OAuthLoginResponse {
        val existingUser = userRepository.findByOauthProviderAndOauthId(provider, info.oauthId)
        val user = existingUser ?: userRepository.save(
            User(
                userId = "${provider.name}_${info.oauthId}",
                nickname = info.nickname,
                email = info.email,
                oauthProvider = provider,
                oauthId = info.oauthId,
                profileImageUrl = info.profileImageUrl,
            )
        )

        val accessToken = jwtTokenProvider.generateAccessToken(user.id)
        val refreshToken = jwtTokenProvider.generateRefreshToken(user.id)
        refreshTokenRepository.save(
            RefreshToken(
                user = user,
                token = refreshToken,
                expiresAt = LocalDateTime.now().plusSeconds(jwtProperties.refreshTokenExpirySeconds),
            )
        )

        return OAuthLoginResponse(
            accessToken = accessToken,
            refreshToken = refreshToken,
            isNewUser = existingUser == null,
        )
    }
}
