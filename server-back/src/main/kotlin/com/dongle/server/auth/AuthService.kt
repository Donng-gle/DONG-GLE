package com.dongle.server.auth

import com.dongle.server.auth.dto.OAuthLoginResponse
import com.dongle.server.auth.dto.RefreshResponse
import com.dongle.server.auth.jwt.JwtTokenProvider
import com.dongle.server.auth.oauth.AppleOAuthClient
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
    private val appleOAuthClient: AppleOAuthClient,
    private val jwtTokenProvider: JwtTokenProvider,
    private val jwtProperties: JwtProperties,
) {
    fun loginWithKakao(code: String): OAuthLoginResponse =
        login(OAuthProvider.kakao, kakaoOAuthClient.getUserInfo(code))

    fun loginWithGoogle(idToken: String): OAuthLoginResponse =
        login(OAuthProvider.google, googleOAuthClient.getUserInfo(idToken))

    fun loginWithApple(idToken: String): OAuthLoginResponse =
        login(OAuthProvider.apple, appleOAuthClient.getUserInfo(idToken))

    // 리프레시 토큰 회전(2026-09-04 도입) — 갱신 때마다 새 리프레시 토큰을 발급하고 기존 것은 바로
    // 폐기함. 예전엔 액세스 토큰만 새로 내주고 리프레시 토큰은 원래 만료 시각까지 계속 재사용됐는데,
    // 토큰이 유출되면 자연 만료 전까지 계속 유효한 문제가 있었음 (decision-log 참고)
    fun refresh(refreshToken: String): RefreshResponse {
        if (!jwtTokenProvider.validate(refreshToken)) throw InvalidRefreshTokenException()

        val stored = refreshTokenRepository.findByToken(refreshToken)
            ?: throw InvalidRefreshTokenException()
        if (stored.expiresAt.isBefore(LocalDateTime.now())) throw InvalidRefreshTokenException()

        val newAccessToken = jwtTokenProvider.generateAccessToken(stored.user.id)
        val newRefreshToken = jwtTokenProvider.generateRefreshToken(stored.user.id)

        refreshTokenRepository.delete(stored)
        refreshTokenRepository.save(
            RefreshToken(
                user = stored.user,
                token = newRefreshToken,
                expiresAt = LocalDateTime.now().plusSeconds(jwtProperties.refreshTokenExpirySeconds),
            )
        )

        return RefreshResponse(accessToken = newAccessToken, refreshToken = newRefreshToken)
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
