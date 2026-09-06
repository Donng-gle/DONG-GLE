package com.dongle.server.visitlog.dto

import java.time.LocalDateTime

data class VisitLogSummaryResponse(
    val id: Long,
    val photoUrls: List<String>,
    val title: String?,
    val oneLine: String?,
    val weather: String?,
    val rating: Int?,
    val visitedAt: LocalDateTime,
    val tags: List<String>,
)
