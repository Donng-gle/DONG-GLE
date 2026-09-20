package com.dongle.server.health.dto

import java.time.LocalDateTime

data class HealthResponse(
    val status: String,
    val version: String,
    val timestamp: LocalDateTime,
)
