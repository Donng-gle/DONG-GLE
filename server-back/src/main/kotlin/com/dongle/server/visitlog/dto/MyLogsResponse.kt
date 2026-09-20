package com.dongle.server.visitlog.dto

import com.dongle.server.common.PaginationMeta

data class MyLogsResponse(
    val logs: List<VisitLogMapItemResponse>,
    val meta: PaginationMeta,
)
