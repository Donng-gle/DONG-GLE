package com.dongle.server.auth.oauth

import com.dongle.server.auth.InvalidGoogleIdTokenException
import com.dongle.server.common.config.OAuthProperties
import io.jsonwebtoken.Jwts
import org.junit.jupiter.api.Assertions.assertEquals
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

// 실제 구글 없이(라이브 JWKS 엔드포인트 호출 없이) 서명 검증 로직 자체를 검증하는 순수 단위 테스트.
// 자체 RSA 키페어로 진짜 서명된 ID 토큰을 만들고, MockRestServiceServer로 그 키페어의 공개키를
// JWKS 응답인 척 흘려보내서 GoogleOAuthClient가 정말로 서명/발급자/audience를 검증하는지 확인한다.
class GoogleOAuthClientTest {

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
        issuer: String = "https://accounts.google.com",
        audience: String = WEB_CLIENT_ID,
        subject: String = "google-user-1",
        expiresAt: Date = Date(System.currentTimeMillis() + 60_000),
        signingKey: PrivateKey = keyPair.private,
    ): String =
        Jwts.builder()
            .setHeaderParam("kid", KID)
            .issuer(issuer)
            .setAudience(audience)
            .subject(subject)
            .claim("email", "user@example.com")
            .claim("name", "테스트유저")
            .claim("picture", "https://example.com/pic.jpg")
            .expiration(expiresAt)
            .signWith(signingKey)
            .compact()

    private fun newClientBoundTo(): Pair<GoogleOAuthClient, MockRestServiceServer> {
        val builder = RestClient.builder().baseUrl("https://www.googleapis.com")
        val mockServer = MockRestServiceServer.bindTo(builder).build()
        val properties = OAuthProperties(
            kakao = OAuthProperties.Provider(clientId = "kakao-client-id", redirectUri = "kakao://"),
            google = OAuthProperties.Provider(clientId = WEB_CLIENT_ID, redirectUri = "https://dong-gle.onrender.com"),
        )
        return GoogleOAuthClient(properties, builder.build()) to mockServer
    }

    private fun MockRestServiceServer.expectJwksRequest() {
        expect(requestTo("https://www.googleapis.com/oauth2/v3/certs"))
            .andRespond(withSuccess(jwksJson(), MediaType.APPLICATION_JSON))
    }

    @Test
    fun `유효한 ID 토큰이면 클레임에서 사용자 정보를 추출한다`() {
        val (client, mockServer) = newClientBoundTo()
        mockServer.expectJwksRequest()

        val info = client.getUserInfo(signedIdToken())

        assertEquals("google-user-1", info.oauthId)
        assertEquals("테스트유저", info.nickname)
        assertEquals("user@example.com", info.email)
        assertEquals("https://example.com/pic.jpg", info.profileImageUrl)
    }

    @Test
    fun `audience가 우리 웹 클라이언트 ID와 다르면 예외를 던진다`() {
        val (client, mockServer) = newClientBoundTo()
        mockServer.expectJwksRequest()

        assertThrows<InvalidGoogleIdTokenException> {
            client.getUserInfo(signedIdToken(audience = "other-app.apps.googleusercontent.com"))
        }
    }

    @Test
    fun `issuer가 구글이 아니면 예외를 던진다`() {
        val (client, mockServer) = newClientBoundTo()
        mockServer.expectJwksRequest()

        assertThrows<InvalidGoogleIdTokenException> {
            client.getUserInfo(signedIdToken(issuer = "https://evil.example.com"))
        }
    }

    @Test
    fun `다른 키로 서명됐으면 예외를 던진다`() {
        val (client, mockServer) = newClientBoundTo()
        mockServer.expectJwksRequest()
        val otherKeyPair = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.genKeyPair()

        // kid는 진짜 등록된 키를 가리키지만, 실제 서명은 다른(탈취되지 않은) 개인키로 했다고 가정
        assertThrows<InvalidGoogleIdTokenException> {
            client.getUserInfo(signedIdToken(signingKey = otherKeyPair.private))
        }
    }

    @Test
    fun `만료된 토큰이면 예외를 던진다`() {
        val (client, mockServer) = newClientBoundTo()
        mockServer.expectJwksRequest()

        assertThrows<InvalidGoogleIdTokenException> {
            client.getUserInfo(signedIdToken(expiresAt = Date(System.currentTimeMillis() - 60_000)))
        }
    }

    companion object {
        private const val KID = "test-kid-1"
        private const val WEB_CLIENT_ID = "web-client-id.apps.googleusercontent.com"
    }
}
