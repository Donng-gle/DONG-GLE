package com.dongle.server.onboarding

import kotlin.math.abs
import kotlin.math.sqrt

// 7개 감성 태그 독립 벡터. 온보딩 알고리즘 v2.0.0(server-back/Onboarding Algo.md) 기준.
data class EmotionVector(
    val relaxing: Double = 0.5,
    val lively: Double = 0.5,
    val romantic: Double = 0.5,
    val local: Double = 0.5,
    val photogenic: Double = 0.5,
    val traditional: Double = 0.5,
    val modern: Double = 0.5,
) {
    fun toMap(): Map<String, Double> = linkedMapOf(
        "relaxing" to relaxing,
        "lively" to lively,
        "romantic" to romantic,
        "local" to local,
        "photogenic" to photogenic,
        "traditional" to traditional,
        "modern" to modern,
    )

    fun average(): Double = toMap().values.average()

    fun topTags(n: Int): List<String> = toMap().entries.sortedByDescending { it.value }.take(n).map { it.key }

    fun bottomTags(n: Int): List<String> = toMap().entries.sortedBy { it.value }.take(n).map { it.key }

    fun cosineSimilarity(other: EmotionVector): Double {
        val a = toMap().values.toList()
        val b = other.toMap().values.toList()
        val dot = a.zip(b).sumOf { (x, y) -> x * y }
        val normA = sqrt(a.sumOf { it * it })
        val normB = sqrt(b.sumOf { it * it })
        if (normA == 0.0 || normB == 0.0) return 0.0
        return dot / (normA * normB)
    }

    // 상대적 업데이트: 카드 평균 기준으로 강한 태그는 올리고 약한 태그는 내림 (Onboarding Algo.md 7장)
    fun applySwipe(cardVector: EmotionVector, action: OnboardingAction): EmotionVector {
        val cardAverage = cardVector.average()
        val rate = if (action == OnboardingAction.like) LIKE_RATE else -DISLIKE_RATE
        val updated = toMap().mapValues { (tag, score) ->
            val relative = cardVector.toMap().getValue(tag) - cardAverage
            (score + relative * rate).coerceIn(0.0, 1.0)
        }
        return of(updated)
    }

    // 변화량 = Σ|after[t]-before[t]|/7
    fun changeAmountFrom(before: EmotionVector): Double {
        val diffs = toMap().entries.sumOf { (tag, value) -> abs(value - before.toMap().getValue(tag)) }
        return diffs / TAGS.size
    }

    companion object {
        val TAGS = listOf("relaxing", "lively", "romantic", "local", "photogenic", "traditional", "modern")

        private const val LIKE_RATE = 0.40
        private const val DISLIKE_RATE = 0.25

        fun of(map: Map<String, Double>): EmotionVector = EmotionVector(
            relaxing = map["relaxing"] ?: 0.5,
            lively = map["lively"] ?: 0.5,
            romantic = map["romantic"] ?: 0.5,
            local = map["local"] ?: 0.5,
            photogenic = map["photogenic"] ?: 0.5,
            traditional = map["traditional"] ?: 0.5,
            modern = map["modern"] ?: 0.5,
        )
    }
}
