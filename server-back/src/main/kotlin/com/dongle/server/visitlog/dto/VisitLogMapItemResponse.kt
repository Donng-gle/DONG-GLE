package com.dongle.server.visitlog.dto

import java.time.LocalDateTime

data class VisitLogMapItemResponse(
    val id: Long,
    val placeId: Long,
    val placeName: String,
    val lat: Double?,
    val lng: Double?,
    val photoUrl: String?,
    val oneLine: String?,
    val visitedAt: LocalDateTime,
    val tags: List<String>,
)
