package com.dongle.server.onboarding.dto

data class OnboardingCardResponse(
    val id: Long,
    val name: String,
    val imageUrl: String,
    val vector: UserVectorResponse,
    val isSeed: Boolean,
)
