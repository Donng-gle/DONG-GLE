package com.dongle.server.onboarding.dto

data class OnboardingCompleteResponse(
    val userVector: UserVectorResponse,
    val topTags: List<String>,
)
