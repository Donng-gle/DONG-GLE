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
)
