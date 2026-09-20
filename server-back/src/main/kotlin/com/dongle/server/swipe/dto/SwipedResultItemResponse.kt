package com.dongle.server.swipe.dto

import com.dongle.server.swipe.SwipeAction

data class SwipedResultItemResponse(
    val placeId: Long,
    val action: SwipeAction,
)
