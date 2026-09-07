package com.dongle.server.course.optimizer

// ai/course_optimizer.models.ScoredRoute와 1:1 대응
data class ScoredRoute(
    val stops: List<VisitStop>,
    val score: RouteScoreBreakdown,
)
