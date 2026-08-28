package com.dongle.server.auth.dto

data class OAuthLoginResponse(
    val accessToken: String,
    val refreshToken: String,
    val isNewUser: Boolean,
)
