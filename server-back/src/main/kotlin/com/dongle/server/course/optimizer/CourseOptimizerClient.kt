package com.dongle.server.course.optimizer

import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException

// ai/course_optimizer(김지광, ai/api/app.py FastAPI 서비스로 배포)를 감싸는 HTTP 클라이언트.
// 요청/응답 계약은 ai/course_optimizer/models.py의 TripInput/CourseOptimizationResult와 1:1 대응하도록
// 이 패키지의 DTO들을 미러링해뒀다 (2026-08-26 결정: 후보 선정/공개 API 계약 정리는 범위 밖, 클라이언트만 우선 구현).
//
// OPTIMIZE_PATH("/v1/courses/optimize")는 ai/api/app.py에 실제로 구현된 라우트로 확인 완료 (2026-08-30).
// 남은 미검증 사항:
//  - COURSE_OPTIMIZER_BASE_URL 미설정 시 로컬 기본값(application.yml)으로 폴백
//  - 날짜/시간 필드(LocalDateTime) 직렬화 포맷이 Pydantic 쪽과 실제로 맞는지는 서비스가 뜬 뒤 검증 필요
@Component
class CourseOptimizerClient(
    private val courseOptimizerRestClient: RestClient,
) {
    fun optimizeCourse(input: TripInput): CourseOptimizationResult =
        try {
            courseOptimizerRestClient.post()
                .uri(OPTIMIZE_PATH)
                .body(input)
                .retrieve()
                .body(CourseOptimizationResult::class.java)
                ?: throw CourseOptimizerUpstreamException(IllegalStateException("빈 응답 본문"))
        } catch (e: RestClientException) {
            throw CourseOptimizerUpstreamException(e)
        }

    companion object {
        private const val OPTIMIZE_PATH = "/v1/courses/optimize"
    }
}
