package com.dongle.server.recommend

// ai/place_recommender.models.RecommendRequest와 1:1 대응하는 요청 계약.
// 항상 preferences 리스트로 취향을 전달한다 (relaxing/lively 같은 개별 flat 필드는 안 씀 —
// Python 쪽 RecommendRequest.to_major_scores()가 두 형태를 다 받지만, 이 클라이언트는 하나로 통일).
// preferences가 비어있으면 Python 쪽 검증(require_preference_values)이 실패하므로 항상 최소 1개 이상 채워서 보낸다.
data class RecommendRequest(
    val preferences: List<PreferenceTagItem>,
    val topN: Int,
    val minSimilarity: Double = 0.0,
    val excludePlaceIds: List<String> = emptyList(),
    val category: String? = null,
)
