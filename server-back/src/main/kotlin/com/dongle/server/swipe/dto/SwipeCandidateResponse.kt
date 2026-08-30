package com.dongle.server.swipe.dto

data class SwipeCandidateResponse(
    val placeId: Long,
    val name: String,
    val mainImageUrl: String?,
    val category: String,
    val tags: List<String>,
)
