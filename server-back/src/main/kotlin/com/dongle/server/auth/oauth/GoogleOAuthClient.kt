package com.dongle.server.auth.oauth

import com.dongle.server.auth.InvalidGoogleIdTokenException
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

// 구글 ID 토큰 검증 (2026-08-26 결정: code→client_secret 교환 방식에서 전환).
// 앱이 기기 내 네이티브 Google Sign-In(Android OAuth 클라이언트, 패키지명+SHA-1로 신원 증명)으로
// 로그인해 받은 ID 토큰을 그대로 넘겨받는다. 이 ID 토큰의 audience는 Web 애플리케이션 OAuth
// 클라이언트("서버 클라이언트 ID" 역할, redirect_uri는 이 흐름에서 실제로 쓰이지 않음)로 지정되므로,
// 서버는 서명·발급자·audience만 검증하면 되고 code→token 교환이나 /userinfo 호출이 필요 없다
// (클레임에 사용자 정보가 이미 들어있음). 카카오는 기존 인가 코드 교환 방식을 그대로 유지.
@Component
class GoogleOAuthClient(
    private val oAuthProperties: OAuthProperties,
    private val googleJwksRestClient: RestClient,
) {
    private val jwksCache = AtomicReference<CachedJwks?>()

    fun getUserInfo(idToken: String): OAuthUserInfo {
        val claims = try {
            Jwts.parser()
                .keyLocator(googleKeyLocator)
                .build()
                .parseSignedClaims(idToken)
                .payload
        } catch (e: JwtException) {
            throw InvalidGoogleIdTokenException("서명 또는 형식이 유효하지 않음")
        } catch (e: IllegalArgumentException) {
            throw InvalidGoogleIdTokenException("서명 또는 형식이 유효하지 않음")
        }

        if (claims.issuer !in ALLOWED_ISSUERS) {
            throw InvalidGoogleIdTokenException("issuer 불일치: ${claims.issuer}")
        }
        if (claims.audience.singleOrNull() != oAuthProperties.google.clientId) {
            throw InvalidGoogleIdTokenException("audience 불일치")
        }

        return OAuthUserInfo(
            oauthId = claims.subject,
            nickname = claims["name"] as? String ?: "구글유저",
            email = claims["email"] as? String,
            profileImageUrl = claims["picture"] as? String,
        )
    }

    // JWT 헤더의 kid로 구글 공개키(JWKS) 중 서명 검증에 쓸 키를 찾아준다.
    // 캐시에 없는 kid가 오면(키 로테이션 대응) 한 번만 강제로 새로고침해서 재시도한다
    private val googleKeyLocator = Locator<Key> { header ->
        val kid = header["kid"] as? String ?: throw InvalidGoogleIdTokenException("kid 없음")
        keysByKid()[kid]
            ?: keysByKid(forceRefresh = true)[kid]
            ?: throw InvalidGoogleIdTokenException("일치하는 구글 공개키 없음 (kid=$kid)")
    }

    private fun keysByKid(forceRefresh: Boolean = false): Map<String, Key> {
        val cached = jwksCache.get()
        if (!forceRefresh && cached != null && cached.expiresAt.isAfter(Instant.now())) {
            return cached.keysByKid
        }

        val response = try {
            googleJwksRestClient.get()
                .uri(GOOGLE_CERTS_URL)
                .retrieve()
                .body(GoogleCertsResponse::class.java)
                ?: throw InvalidGoogleIdTokenException("구글 공개키 응답 없음")
        } catch (e: RestClientException) {
            throw InvalidGoogleIdTokenException("구글 공개키 조회 실패")
        }

        val keys = response.keys.associate { it.kid to it.toRsaPublicKey() }
        jwksCache.set(CachedJwks(keys, Instant.now().plusSeconds(JWKS_CACHE_TTL_SECONDS)))
        return keys
    }

    private data class CachedJwks(val keysByKid: Map<String, Key>, val expiresAt: Instant)

    companion object {
        private const val GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
        private const val JWKS_CACHE_TTL_SECONDS = 3600L
        private val ALLOWED_ISSUERS = setOf("https://accounts.google.com", "accounts.google.com")
    }
}

private data class GoogleCertsResponse(val keys: List<GoogleJwk>)

private data class GoogleJwk(val kid: String, val n: String, val e: String) {
    fun toRsaPublicKey(): Key {
        val modulus = BigInteger(1, Base64.getUrlDecoder().decode(n))
        val exponent = BigInteger(1, Base64.getUrlDecoder().decode(e))
        return KeyFactory.getInstance("RSA").generatePublic(RSAPublicKeySpec(modulus, exponent))
    }
}
