package com.dongle.server.onboarding.dto

import com.dongle.server.onboarding.OnboardingAction
import jakarta.validation.constraints.NotNull

data class OnboardingSwipeRequest(
    @field:NotNull
    val cardId: Long?,
    @field:NotNull
    val action: OnboardingAction?,
)
