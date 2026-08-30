package com.dongle.server.swipe.dto

import com.dongle.server.swipe.SwipeAction
import jakarta.validation.Valid
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.NotNull

data class SwipeResultRequest(
    @field:NotEmpty
    @field:Valid
    val swipes: List<SwipeResultItem> = emptyList(),
)

data class SwipeResultItem(
    @field:NotNull
    val placeId: Long? = null,

    @field:NotNull
    val action: SwipeAction? = null,
)
