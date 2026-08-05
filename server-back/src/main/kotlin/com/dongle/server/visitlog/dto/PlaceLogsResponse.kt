package com.dongle.server.visitlog.dto

import com.dongle.server.common.PaginationMeta

data class PlaceLogsResponse(
    val logs: List<VisitLogSummaryResponse>,
    val meta: PaginationMeta,
)
