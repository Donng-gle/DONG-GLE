package com.dongle.server.explore.dto

data class SimilarLogItemResponse(
    val logId: Long,
    val placeId: Long,
    val placeName: String,
    val lat: Double?,
    val lng: Double?,
    val photoUrl: String?,
    val oneLine: String?,
    val tags: List<String>,
)
