package com.dongle.server.visitlog.dto

import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.Size
import java.time.LocalDateTime

data class VisitLogCreateRequest(
    val photoUrl: String? = null,

    @field:Size(max = 50)
    val title: String? = null,

    @field:Size(max = 100)
    val oneLine: String? = null,

    @field:Size(max = 20)
    val weather: String? = null,

    @field:Min(1)
    @field:Max(5)
    val rating: Int? = null,

    val visitedAt: LocalDateTime? = null,
)
