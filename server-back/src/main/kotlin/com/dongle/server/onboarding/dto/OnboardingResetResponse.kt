package com.dongle.server.onboarding.dto

data class OnboardingResetResponse(
    val userVector: UserVectorResponse,
    val message: String,
)
