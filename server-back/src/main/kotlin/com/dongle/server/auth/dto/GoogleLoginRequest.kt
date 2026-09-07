package com.dongle.server.auth.dto

import jakarta.validation.constraints.NotBlank

// 카카오(OAuthLoginRequest.code, 인가 코드)와 달리 구글은 앱이 네이티브 로그인으로 받은 ID 토큰을 그대로 전달받는다
data class GoogleLoginRequest(
    @field:NotBlank
    val idToken: String,
)
