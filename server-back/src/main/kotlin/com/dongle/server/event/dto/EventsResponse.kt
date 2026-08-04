package com.dongle.server.event.dto

import com.dongle.server.common.PaginationMeta

data class EventsResponse(
    val events: List<EventListItemResponse>,
    val meta: PaginationMeta,
)
