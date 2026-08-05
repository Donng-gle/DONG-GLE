package com.dongle.server.visitlog.dto

import java.time.LocalDateTime

data class VisitLogDetailResponse(
    val id: Long,
    val placeId: Long,
    val placeName: String,
    val photoUrl: String?,
    val oneLine: String?,
    val visitedAt: LocalDateTime,
    val tags: List<String>,
)
