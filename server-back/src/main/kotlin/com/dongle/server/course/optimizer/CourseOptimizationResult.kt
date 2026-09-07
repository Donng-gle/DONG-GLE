package com.dongle.server.course.optimizer

// ai/course_optimizer.models.CourseOptimizationResult과 1:1 대응하는 응답 계약.
// 백트래킹으로 찾은 실행 가능한 경로 중 종합 점수 최댓값 1개(selectedRoute)만 반환한다 —
// api_1.3.1v.yaml의 CourseGenerateResponse(최대 3개 후보 candidates)와는 응답 형태 자체가 다름,
// 공개 API 계약에 연결할 때 이 차이를 어떻게 흡수할지는 별도 결정 필요 (아직 미정)
data class CourseOptimizationResult(
    val selectedRoute: ScoredRoute,
    val candidateRouteCount: Int,
    val evaluatedRouteCount: Int,
    val targetVisitCount: Int,
    val freeTimeMinutes: Int = 0,
    val promptVersion: String,
    val modelName: String,
    val excludedPlaceIds: List<String> = emptyList(),
    val excludedPlaces: List<String> = emptyList(),
    val exclusionReason: Map<String, String> = emptyMap(),
    val replacedPlaces: Map<String, String> = emptyMap(),
)
