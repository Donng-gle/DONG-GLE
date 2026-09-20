package com.dongle.server.visitlog.dto

import java.time.LocalDateTime

data class VisitLogMapItemResponse(
    val id: Long,
    val placeId: Long,
    val placeName: String,
    // 코스 단위 기록일 때만 값 있음 — 프론트가 같은 courseId끼리 묶어서 "나의 일지"에 코스 카드로
    // 보여줌 (2026-09-08 추가, decision-log 참고)
    val courseId: Long?,
    val courseTitle: String?,
    val lat: Double?,
    val lng: Double?,
    val photos: List<VisitLogPhotoResponse>,
    val title: String?,
    val oneLine: String?,
    val weather: String?,
    val rating: Int?,
    val visitedAt: LocalDateTime,
    val tags: List<String>,
)
