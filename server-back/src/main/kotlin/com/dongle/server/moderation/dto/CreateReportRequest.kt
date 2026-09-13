package com.dongle.server.moderation.dto

import com.dongle.server.moderation.ReportReason
import com.dongle.server.moderation.ReportTargetType
import jakarta.validation.constraints.NotNull

data class CreateReportRequest(
    @field:NotNull
    val targetType: ReportTargetType?,

    @field:NotNull
    val targetId: Long?,

    @field:NotNull
    val reason: ReportReason?,

    val detail: String? = null,
)
