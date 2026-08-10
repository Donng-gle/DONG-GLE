package com.dongle.server.onboarding.dto

data class OnboardingSwipeResponse(
    val userVector: UserVectorResponse,
    val totalSeen: Int,
    val isConverged: Boolean,
    val recentChange: Double,
)
