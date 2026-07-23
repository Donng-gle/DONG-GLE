package com.dongle.server.place.dto

data class PlaceMapResponse(
    val pins: List<PlaceMapPinResponse>,
    val total: Int,
)
