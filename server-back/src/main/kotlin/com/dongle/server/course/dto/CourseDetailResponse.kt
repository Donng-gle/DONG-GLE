package com.dongle.server.course.dto

import java.time.LocalDate
import java.time.LocalDateTime

data class CourseDetailResponse(
    val id: Long,
    val title: String,
    val travelDate: LocalDate?,
    // 여러 날 범위 지원(2026-09-06 결정, decision-log 참고) — "직접 코스 만들기"에서만 채워짐
    val endDate: LocalDate?,
    val source: String,
    val places: List<CoursePlaceItemResponse>,
    // 구글맵 Directions 연동 전까지는 항상 null (스프린트3 스코프 외, TODO)
    val totalDistanceKm: Double?,
    val totalDurationMin: Int?,
    val polyline: String?,
    val updatedAt: LocalDateTime,
)
