package com.dongle.server.recommend

data class RecommendResponse(
    val recommendations: List<RecommendationItem> = emptyList(),
)
