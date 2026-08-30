package com.dongle.server.course.dto

data class CourseCandidateResponse(
    val candidateId: String,
    val title: String,
    val places: List<CoursePlaceItemResponse>,
    // course_optimizer는 km 단위 거리를 안 주므로(이동 "시간"만 최적화 대상) 구글맵 Directions 연동 전까지 항상 null
    val totalDistanceKm: Double?,
    val totalDurationMin: Int?,
)
