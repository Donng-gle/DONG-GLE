package com.dongle.server.auth.oauth

data class OAuthUserInfo(
    val oauthId: String,
    val nickname: String,
    val email: String?,
    val profileImageUrl: String?,
)
