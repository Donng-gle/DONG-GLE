package com.dongle.server.onboarding

import org.springframework.data.jpa.repository.JpaRepository

interface OnboardingSwipeLogRepository : JpaRepository<OnboardingSwipeLog, Long> {

    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<OnboardingSwipeLog>

    fun deleteAllByUserId(userId: Long)
}
