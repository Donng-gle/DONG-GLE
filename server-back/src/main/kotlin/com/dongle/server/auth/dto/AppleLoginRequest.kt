package com.dongle.server.auth.dto

import jakarta.validation.constraints.NotBlank

// 구글과 동일한 패턴 — 앱이 기기 내 네이티브 Sign in with Apple(expo-apple-authentication)로 받은
// ID 토큰을 그대로 전달받는다
data class AppleLoginRequest(
    @field:NotBlank
    val idToken: String,
)
