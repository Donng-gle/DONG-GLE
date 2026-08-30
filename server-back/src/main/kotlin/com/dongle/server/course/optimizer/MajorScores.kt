package com.dongle.server.course.optimizer

// ai/semantic_vector.models.MajorScores와 동일한 7개 대분류 태그 점수 (ssot.md 감성태그셋 참고)
data class MajorScores(
    val relaxing: Double,
    val lively: Double,
    val romantic: Double,
    val local: Double,
    val photogenic: Double,
    val traditional: Double,
    val modern: Double,
)
