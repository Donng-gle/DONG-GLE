package com.dongle.server.place.dto

data class PlaceListItemResponse(
    val id: Long,
    val name: String,
    val category: String,
    val mainImageUrl: String?,
    val addr1: String?,
    val lat: Double?,
    val lng: Double?,
    val tags: List<String>,
    val isLiked: Boolean,
)
