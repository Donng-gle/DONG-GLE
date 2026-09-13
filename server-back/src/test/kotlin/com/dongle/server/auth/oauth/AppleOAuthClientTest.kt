package com.dongle.server.auth.oauth

import com.dongle.server.auth.InvalidAppleIdTokenException
import com.dongle.server.common.config.OAuthProperties
import io.jsonwebtoken.Jwts
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient
import java.math.BigInteger
import java.security.KeyPairGenerator
import java.security.PrivateKey
import java.security.interfaces.RSAPublicKey
import java.util.Base64
import java.util.Date

// GoogleOAuthClientTest와 동일한 방식 — 자체 RSA 키페어로 서명한 ID 토큰 + MockRestServiceServer로
// JWKS 응답을 흉내내서 서명/발급자/audience 검증 로직을 실제 애플 없이 검증한다.
class AppleOAuthClientTest {

    private val keyPair = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.genKeyPair()

    private fun jwksJson(): String {
        val publicKey = keyPair.public as RSAPublicKey
        return """{"keys":[{"kty":"RSA","kid":"$KID","n":"${base64Url(publicKey.modulus)}","e":"${base64Url(publicKey.publicExponent)}"}]}"""
    }

    private fun base64Url(value: BigInteger): String {
        var bytes = value.toByteArray()
        if (bytes.size > 1 && bytes[0] == 0.toByte()) bytes = bytes.copyOfRange(1, bytes.size)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    private fun signedIdToken(
        issuer: String = "https://appleid.apple.com",
        audience: String = BUNDLE_ID,
        subject: String = "apple-user-1",
        email: String? = "user@example.com",
        expiresAt: Date = Date(System.currentTimeMillis() + 60_000),
        signingKey: PrivateKey = keyPair.private,
    ): String {
        val builder = Jwts.builder()
            .setHeaderParam("kid", KID)
            .issuer(issuer)
            .setAudience(audience)
            .subject(subject)
            .expiration(expiresAt)
        if (email != null) builder.claim("email", email)
        return builder.signWith(signingKey).compact()
    }

    private fun newClientBoundTo(): Pair<AppleOAuthClient, MockRestServiceServer> {
        val builder = RestClient.builder().baseUrl("https://appleid.apple.com")
        val mockServer = MockRestServiceServer.bindTo(builder).build()
        val properties = OAuthProperties(
            kakao = OAuthProperties.Provider(clientId = "kakao-client-id", redirectUri = "kakao://"),
            google = OAuthProperties.Provider(clientId = "google-client-id", redirectUri = "https://dong-gle.onrender.com"),
            apple = OAuthProperties.AppleProvider(clientId = BUNDLE_ID),
        )
        return AppleOAuthClient(properties, builder.build()) to mockServer
    }

    private fun MockRestServiceServer.expectJwksRequest() {
        expect(requestTo("https://appleid.apple.com/auth/keys"))
            .andRespond(withSuccess(jwksJson(), MediaType.APPLICATION_JSON))
    }

    @Test
    fun `유효한 ID 토큰이면 클레임에서 사용자 정보를 추출한다`() {
        val (client, mockServer) = newClientBoundTo()
        mockServer.expectJwksRequest()

        val info = client.getUserInfo(signedIdToken())

        assertEquals("apple-user-1", info.oauthId)
        assertEquals("애플유저", info.nickname)
        assertEquals("user@example.com", info.email)
        assertNull(info.profileImageUrl)
    }

    @Test
    fun `email 클레임이 없어도(재로그인 등) 정상 처리한다`() {
        val (client, mockServer) = newClientBoundTo()
        mockServer.expectJwksRequest()

        val info = client.getUserInfo(signedIdToken(email = null))

        assertEquals("apple-user-1", info.oauthId)
        assertNull(info.email)
    }

    @Test
    fun `audience가 우리 앱 번들 ID와 다르면 예외를 던진다`() {
        val (client, mockServer) = newClientBoundTo()
        mockServer.expectJwksRequest()

        assertThrows<InvalidAppleIdTokenException> {
            client.getUserInfo(signedIdToken(audience = "com.other.app"))
        }
    }

    @Test
    fun `issuer가 애플이 아니면 예외를 던진다`() {
        val (client, mockServer) = newClientBoundTo()
        mockServer.expectJwksRequest()

        assertThrows<InvalidAppleIdTokenException> {
            client.getUserInfo(signedIdToken(issuer = "https://evil.example.com"))
        }
    }

    @Test
    fun `다른 키로 서명됐으면 예외를 던진다`() {
        val (client, mockServer) = newClientBoundTo()
        mockServer.expectJwksRequest()
        val otherKeyPair = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.genKeyPair()

        assertThrows<InvalidAppleIdTokenException> {
            client.getUserInfo(signedIdToken(signingKey = otherKeyPair.private))
        }
    }

    @Test
    fun `만료된 토큰이면 예외를 던진다`() {
        val (client, mockServer) = newClientBoundTo()
        mockServer.expectJwksRequest()

        assertThrows<InvalidAppleIdTokenException> {
            client.getUserInfo(signedIdToken(expiresAt = Date(System.currentTimeMillis() - 60_000)))
        }
    }

    companion object {
        private const val KID = "test-kid-1"
        private const val BUNDLE_ID = "com.dongle.andong"
    }
}
