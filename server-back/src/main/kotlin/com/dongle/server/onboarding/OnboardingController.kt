package com.dongle.server.onboarding

import com.dongle.server.onboarding.dto.OnboardingCompleteResponse
import com.dongle.server.onboarding.dto.OnboardingNextResponse
import com.dongle.server.onboarding.dto.OnboardingResetResponse
import com.dongle.server.onboarding.dto.OnboardingStatusResponse
import com.dongle.server.onboarding.dto.OnboardingSwipeRequest
import com.dongle.server.onboarding.dto.OnboardingSwipeResponse
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/onboarding")
class OnboardingController(
    private val onboardingService: OnboardingService,
) {
    @GetMapping("/status")
    fun getStatus(authentication: Authentication): OnboardingStatusResponse =
        onboardingService.getStatus(authentication.userId())

    @GetMapping("/next")
    fun getNextCard(authentication: Authentication): ResponseEntity<OnboardingNextResponse> {
        val next = onboardingService.getNextCard(authentication.userId())
        return if (next != null) ResponseEntity.ok(next) else ResponseEntity.noContent().build()
    }

    @PostMapping("/swipe")
    fun swipe(
        authentication: Authentication,
        @Valid @RequestBody request: OnboardingSwipeRequest,
    ): OnboardingSwipeResponse = onboardingService.swipe(authentication.userId(), request)

    @PostMapping("/complete")
    fun complete(authentication: Authentication): OnboardingCompleteResponse =
        onboardingService.complete(authentication.userId())

    @PostMapping("/reset")
    fun reset(authentication: Authentication): OnboardingResetResponse =
        onboardingService.reset(authentication.userId())
}

private fun Authentication.userId(): Long = principal as Long
