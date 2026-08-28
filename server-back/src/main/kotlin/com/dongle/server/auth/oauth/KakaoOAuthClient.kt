package com.dongle.server.auth.oauth

import com.dongle.server.auth.InvalidOAuthCodeException
import com.dongle.server.common.config.OAuthProperties
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException

@Component
class KakaoOAuthClient(
    private val oAuthProperties: OAuthProperties,
) {
    private val restClient = RestClient.create()

    fun getUserInfo(code: String): OAuthUserInfo =
        try {
            val kakaoAccessToken = requestToken(code)
            requestUserInfo(kakaoAccessToken)
        } catch (e: RestClientException) {
            throw InvalidOAuthCodeException("kakao")
        }

    private fun requestToken(code: String): String {
        val kakao = oAuthProperties.kakao
        val form = LinkedMultiValueMap<String, String>().apply {
            add("grant_type", "authorization_code")
            add("client_id", kakao.clientId)
            add("redirect_uri", kakao.redirectUri)
            add("code", code)
            if (kakao.clientSecret.isNotBlank()) add("client_secret", kakao.clientSecret)
        }

        val response = restClient.post()
            .uri("https://kauth.kakao.com/oauth/token")
            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .body(form)
            .retrieve()
            .body(KakaoTokenResponse::class.java)
            ?: throw InvalidOAuthCodeException("kakao")

        return response.accessToken
    }

    private fun requestUserInfo(accessToken: String): OAuthUserInfo {
        val response = restClient.get()
            .uri("https://kapi.kakao.com/v2/user/me")
            .header("Authorization", "Bearer $accessToken")
            .retrieve()
            .body(KakaoUserResponse::class.java)
            ?: throw InvalidOAuthCodeException("kakao")

        return OAuthUserInfo(
            oauthId = response.id.toString(),
            nickname = response.kakaoAccount?.profile?.nickname ?: "카카오유저",
            email = response.kakaoAccount?.email,
            profileImageUrl = response.kakaoAccount?.profile?.profileImageUrl,
        )
    }
}

private data class KakaoTokenResponse(
    val accessToken: String,
)

private data class KakaoUserResponse(
    val id: Long,
    val kakaoAccount: KakaoAccount?,
) {
    data class KakaoAccount(
        val email: String?,
        val profile: Profile?,
    ) {
        data class Profile(
            val nickname: String?,
            val profileImageUrl: String?,
        )
    }
}
