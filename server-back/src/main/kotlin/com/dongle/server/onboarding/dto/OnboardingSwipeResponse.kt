package com.dongle.server.onboarding.dto

data class OnboardingSwipeResponse(
    val userVector: UserVectorResponse,
    val totalSeen: Int,
    val isConverged: Boolean,
    val recentChange: Double,
    // 수렴/종료 시 null — GET /onboarding/next를 따로 부르지 않도록 다음 카드를 같이 내려줌
    val nextCard: OnboardingNextResponse?,
)
