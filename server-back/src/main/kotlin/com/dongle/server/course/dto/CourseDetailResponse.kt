package com.dongle.server.course.dto

import java.time.LocalDate
import java.time.LocalDateTime

data class CourseDetailResponse(
    val id: Long,
    val title: String,
    val travelDate: LocalDate?,
    val source: String,
    val places: List<CoursePlaceItemResponse>,
    // 구글맵 Directions 연동 전까지는 항상 null (스프린트3 스코프 외, TODO)
    val totalDistanceKm: Double?,
    val totalDurationMin: Int?,
    val polyline: String?,
    val updatedAt: LocalDateTime,
)
