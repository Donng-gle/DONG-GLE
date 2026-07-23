package com.dongle.server.place.dto

data class FeaturedPlacesResponse(
    val places: List<PlaceListItemResponse>,
    val isPersonalized: Boolean,
)
