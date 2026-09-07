package com.dongle.server.recommend

// ai/place_recommender.models.RecommendationItem과 1:1 대응
data class RecommendationItem(
    val placeId: String,
    val similarityScore: Double,
    val hiddenScore: Double,
    val recommendationScore: Double,
)
