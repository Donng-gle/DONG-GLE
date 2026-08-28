package com.dongle.server.course.dto

import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotNull

data class CoursePlaceRequest(
    @field:NotNull
    val placeId: Long?,

    @field:NotNull
    @field:Min(1)
    val visitOrder: Int?,

    val plannedTime: String? = null,
)
