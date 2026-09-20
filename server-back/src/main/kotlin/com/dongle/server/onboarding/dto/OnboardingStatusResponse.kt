package com.dongle.server.onboarding.dto

data class OnboardingStatusResponse(
    val totalSeen: Int,
    val likeCount: Int,
    val dislikeCount: Int,
    val isConverged: Boolean,
    val userVector: UserVectorResponse,
    val shownCardIds: List<Long>,
)
