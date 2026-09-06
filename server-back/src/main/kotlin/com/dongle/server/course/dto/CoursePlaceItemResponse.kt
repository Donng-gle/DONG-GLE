package com.dongle.server.course.dto

data class CoursePlaceItemResponse(
    val placeId: Long,
    val name: String,
    val visitOrder: Int,
    val plannedTime: String?,
    val lat: Double?,
    val lng: Double?,
    val mainImageUrl: String?,
    // 구글맵 Directions 연동 전까지는 항상 null (스프린트3 스코프 외, TODO)
    val distanceFromPrevKm: Double?,
    val durationFromPrevMin: Int?,
    // 여러 날 코스 지원(2026-09-06 결정, decision-log 참고) — "직접 코스 만들기"에서만 채워짐
    val visitDate: String?,
)
