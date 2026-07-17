package com.dongle.server.common

data class PaginationMeta(
    val total: Long,
    val page: Int,
    val size: Int,
    val hasNext: Boolean,
)
