package com.dongle.server.place.dto

data class PlaceMapPinResponse(
    val id: Long,
    val name: String,
    val category: String,
    val lat: Double?,
    val lng: Double?,
    val mainImageUrl: String?,
    val tags: List<String>,
    val isLiked: Boolean,
)
