package com.dongle.server.auth.oauth

import com.dongle.server.auth.InvalidAppleIdTokenException
import com.dongle.server.common.config.OAuthProperties
import io.jsonwebtoken.JwtException
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.Locator
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import java.math.BigInteger
import java.security.Key
import java.security.KeyFactory
import java.security.spec.RSAPublicKeySpec
import java.time.Instant
import java.util.Base64
import java.util.concurrent.atomic.AtomicReference

// 애플 ID 토큰 검증 — GoogleOAuthClient와 완전히 동일한 구조(2026-09-14 도입, Apple 로그인 앱스토어
// 심사 가이드라인 4.8 대응). 앱이 기기 내 네이티브 Sign in with Apple(expo-apple-authentication)로
// 받은 ID 토큰을 그대로 넘겨받는다. 이 ID 토큰의 audience는 앱의 번들 ID(com.dongle.andong)라서
// 별도 Service ID/client_secret 발급 없이 서명·발급자·audience만 검증하면 된다(구글과 동일하게
// code→token 교환이나 추가 API 호출 불필요).
// 주의: 애플은 이름/프로필 사진 클레임을 ID 토큰에 아예 담지 않고(최초 로그인 시 클라이언트
// authorization 응답에만 한 번 실려오는데, 이 서버는 ID 토큰만 받으므로 그 정보가 없다), email도
// 최초 로그인 이후에는 빠질 수 있어 둘 다 nullable/폴백 처리한다.
@Component
class AppleOAuthClient(
    private val oAuthProperties: OAuthProperties,
    private val appleJwksRestClient: RestClient,
) {
    private val jwksCache = AtomicReference<CachedJwks?>()

    fun getUserInfo(idToken: String): OAuthUserInfo {
        val claims = try {
            Jwts.parser()
                .keyLocator(appleKeyLocator)
                .build()
                .parseSignedClaims(idToken)
                .payload
        } catch (e: JwtException) {
            throw InvalidAppleIdTokenException("서명 또는 형식이 유효하지 않음")
        } catch (e: IllegalArgumentException) {
            throw InvalidAppleIdTokenException("서명 또는 형식이 유효하지 않음")
        }

        if (claims.issuer != ALLOWED_ISSUER) {
            throw InvalidAppleIdTokenException("issuer 불일치: ${claims.issuer}")
        }
        if (claims.audience.singleOrNull() != oAuthProperties.apple.clientId) {
            throw InvalidAppleIdTokenException("audience 불일치")
        }

        return OAuthUserInfo(
            oauthId = claims.subject,
            nickname = "애플유저",
            email = claims["email"] as? String,
            profileImageUrl = null,
        )
    }

    // JWT 헤더의 kid로 애플 공개키(JWKS) 중 서명 검증에 쓸 키를 찾아준다.
    // 캐시에 없는 kid가 오면(키 로테이션 대응) 한 번만 강제로 새로고침해서 재시도한다
    private val appleKeyLocator = Locator<Key> { header ->
        val kid = header["kid"] as? String ?: throw InvalidAppleIdTokenException("kid 없음")
        keysByKid()[kid]
            ?: keysByKid(forceRefresh = true)[kid]
            ?: throw InvalidAppleIdTokenException("일치하는 애플 공개키 없음 (kid=$kid)")
    }

    private fun keysByKid(forceRefresh: Boolean = false): Map<String, Key> {
        val cached = jwksCache.get()
        if (!forceRefresh && cached != null && cached.expiresAt.isAfter(Instant.now())) {
            return cached.keysByKid
        }

        val response = try {
            appleJwksRestClient.get()
                .uri(APPLE_KEYS_URL)
                .retrieve()
                .body(AppleCertsResponse::class.java)
                ?: throw InvalidAppleIdTokenException("애플 공개키 응답 없음")
        } catch (e: RestClientException) {
            throw InvalidAppleIdTokenException("애플 공개키 조회 실패")
        }

        val keys = response.keys.associate { it.kid to it.toRsaPublicKey() }
        jwksCache.set(CachedJwks(keys, Instant.now().plusSeconds(JWKS_CACHE_TTL_SECONDS)))
        return keys
    }

    private data class CachedJwks(val keysByKid: Map<String, Key>, val expiresAt: Instant)

    companion object {
        private const val APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys"
        private const val JWKS_CACHE_TTL_SECONDS = 3600L
        private const val ALLOWED_ISSUER = "https://appleid.apple.com"
    }
}

private data class AppleCertsResponse(val keys: List<AppleJwk>)

private data class AppleJwk(val kid: String, val n: String, val e: String) {
    fun toRsaPublicKey(): Key {
        val modulus = BigInteger(1, Base64.getUrlDecoder().decode(n))
        val exponent = BigInteger(1, Base64.getUrlDecoder().decode(e))
        return KeyFactory.getInstance("RSA").generatePublic(RSAPublicKeySpec(modulus, exponent))
    }
}
