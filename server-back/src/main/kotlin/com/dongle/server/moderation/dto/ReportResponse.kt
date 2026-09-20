package com.dongle.server.moderation.dto

import com.dongle.server.moderation.ReportReason
import com.dongle.server.moderation.ReportStatus
import com.dongle.server.moderation.ReportTargetType
import java.time.LocalDateTime

data class ReportResponse(
    val id: Long,
    val targetType: ReportTargetType,
    val targetId: Long,
    val reason: ReportReason,
    val detail: String?,
    val status: ReportStatus,
    val createdAt: LocalDateTime,
)

data class ReportsResponse(
    val reports: List<ReportResponse>,
)
