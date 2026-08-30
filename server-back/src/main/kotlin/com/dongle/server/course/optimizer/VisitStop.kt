package com.dongle.server.course.optimizer

import java.time.LocalDateTime

// ai/course_optimizer.models.VisitStop과 1:1 대응
data class VisitStop(
    val placeId: String,
    val arrivalTime: LocalDateTime,
    val visitStartTime: LocalDateTime,
    val departureTime: LocalDateTime,
    val actualStayMinutes: Int,
)
