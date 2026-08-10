package com.dongle.server.onboarding.dto

import com.dongle.server.onboarding.CardSelectionStrategy

data class OnboardingNextResponse(
    val card: OnboardingCardResponse,
    val strategy: CardSelectionStrategy,
    val weakTags: List<String>,
)
