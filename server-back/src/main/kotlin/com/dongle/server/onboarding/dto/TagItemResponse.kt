package com.dongle.server.onboarding.dto

data class TagItemResponse(
    val tag: String,
    val label: String,
    val description: String,
    val criteria: List<String>,
)

data class TagsResponse(
    val tags: List<TagItemResponse>,
)
