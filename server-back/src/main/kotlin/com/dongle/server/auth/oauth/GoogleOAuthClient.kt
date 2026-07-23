package com.dongle.server.auth.oauth

import com.dongle.server.auth.InvalidOAuthCodeException
import com.dongle.server.common.config.OAuthProperties
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException

@Component
class GoogleOAuthClient(
    private val oAuthProperties: OAuthProperties,
) {
    private val restClient = RestClient.create()

    fun getUserInfo(code: String): OAuthUserInfo =
        try {
            val accessToken = requestToken(code)
            requestUserInfo(accessToken)
        } catch (e: RestClientException) {
            throw InvalidOAuthCodeException("google")
        }

    private fun requestToken(code: String): String {
        val google = oAuthProperties.google
        val form = LinkedMultiValueMap<String, String>().apply {
            add("grant_type", "authorization_code")
            add("client_id", google.clientId)
            add("client_secret", google.clientSecret)
            add("redirect_uri", google.redirectUri)
            add("code", code)
        }

        val response = restClient.post()
            .uri("https://oauth2.googleapis.com/token")
            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .body(form)
            .retrieve()
            .body(GoogleTokenResponse::class.java)
            ?: throw InvalidOAuthCodeException("google")

        return response.accessToken
    }

    private fun requestUserInfo(accessToken: String): OAuthUserInfo {
        val response = restClient.get()
            .uri("https://www.googleapis.com/oauth2/v3/userinfo")
            .header("Authorization", "Bearer $accessToken")
            .retrieve()
            .body(GoogleUserResponse::class.java)
            ?: throw InvalidOAuthCodeException("google")

        return OAuthUserInfo(
            oauthId = response.sub,
            nickname = response.name ?: "구글유저",
            email = response.email,
            profileImageUrl = response.picture,
        )
    }
}

private data class GoogleTokenResponse(
    val accessToken: String,
)

private data class GoogleUserResponse(
    val sub: String,
    val name: String?,
    val email: String?,
    val picture: String?,
)
