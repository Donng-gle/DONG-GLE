package com.dongle.server.auth.dto

import jakarta.validation.constraints.NotBlank

data class OAuthLoginRequest(
    @field:NotBlank
    val code: String,
)
