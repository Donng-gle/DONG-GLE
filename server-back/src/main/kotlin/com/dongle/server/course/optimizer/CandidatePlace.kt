package com.dongle.server.course.optimizer

// ai/course_optimizer.models.CandidatePlace와 1:1 대응.
// placeId는 우리 DB의 Long PK를 문자열로 담아 보낸다 (course_optimizer는 문자열 식별자 기준으로 동작)
data class CandidatePlace(
    val placeId: String,
    val category: String,
    val majorScores: MajorScores,
    val latitude: Double,
    val longitude: Double,
    val name: String? = null,
    val isOpen: Boolean = true,
)
