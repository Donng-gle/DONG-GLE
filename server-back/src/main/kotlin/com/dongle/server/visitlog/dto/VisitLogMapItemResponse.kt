package com.dongle.server.visitlog.dto

import java.time.LocalDateTime

data class VisitLogMapItemResponse(
    val id: Long,
    val placeId: Long,
    val placeName: String,
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
