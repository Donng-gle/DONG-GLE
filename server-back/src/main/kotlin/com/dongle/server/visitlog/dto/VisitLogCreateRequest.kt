package com.dongle.server.visitlog.dto

import jakarta.validation.constraints.Size
import java.time.LocalDateTime

data class VisitLogCreateRequest(
    val photoUrl: String? = null,

    @field:Size(max = 100)
    val oneLine: String? = null,

    val visitedAt: LocalDateTime? = null,
)
