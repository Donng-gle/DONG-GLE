package com.dongle.server.place.dto

import com.dongle.server.common.PaginationMeta

data class PlacesResponse(
    val places: List<PlaceListItemResponse>,
    val meta: PaginationMeta,
)
