package com.dongle.server.event.dto

import java.time.LocalDate

data class EventListItemResponse(
    val id: Long,
    val name: String,
    val mainImageUrl: String?,
    val addr1: String?,
    val eventStartDate: LocalDate,
    val eventEndDate: LocalDate,
    val tags: List<String>,
    val dDay: Int,
)
