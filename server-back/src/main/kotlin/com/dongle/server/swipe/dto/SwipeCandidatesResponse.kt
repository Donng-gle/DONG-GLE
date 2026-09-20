package com.dongle.server.swipe.dto

import java.time.LocalDateTime

data class SwipeCandidatesResponse(
    val sessionId: String,
    val expiresAt: LocalDateTime,
    val candidates: List<SwipeCandidateResponse>,
)
