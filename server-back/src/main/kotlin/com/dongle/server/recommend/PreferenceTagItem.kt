package com.dongle.server.recommend

// ai/place_recommender.models.PreferenceTag와 1:1 대응
data class PreferenceTagItem(
    val tag: String,
    val score: Double,
)
