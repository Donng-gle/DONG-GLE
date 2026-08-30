package com.dongle.server.course.optimizer

// ai/course_optimizer.models.RouteScoreBreakdown과 1:1 대응.
// time/transition/balance를 합친 게 experience_score, 거기에 travel_score(이동 효율, 절대 정규화)를
// 가중 평균한 게 total_score — course_optimizer.md 6장 종합 점수 공식 참고
data class RouteScoreBreakdown(
    val timeScore: Double,
    val transitionScore: Double,
    val balanceScore: Double,
    val experienceScore: Double,
    val totalTravelMinutes: Int,
    val travelScore: Double,
    val totalScore: Double,
)
