package com.dongle.server.visitlog.dto

import java.time.LocalDateTime

data class VisitLogDetailResponse(
    val id: Long,
    val placeId: Long,
    val placeName: String,
    // 코스 단위 기록일 때만 값 있음(2026-09-08 추가, decision-log 참고)
    val courseId: Long?,
    val courseTitle: String?,
    val photos: List<VisitLogPhotoResponse>,
    val title: String?,
    val oneLine: String?,
    val weather: String?,
    val rating: Int?,
    val visitedAt: LocalDateTime,
    val tags: List<String>,
)
