package com.dongle.server.course.optimizer

import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException

// ai/course_optimizer(김지광, 별도 FastAPI 서비스로 배포 예정)를 감싸는 HTTP 클라이언트.
// 요청/응답 계약은 ai/course_optimizer/models.py의 TripInput/CourseOptimizationResult와 1:1 대응하도록
// 이 패키지의 DTO들을 미러링해뒀다 (2026-08-26 결정: 후보 선정/공개 API 계약 정리는 범위 밖, 클라이언트만 우선 구현).
//
// 아직 실제 서비스가 배포 전이라:
//  - COURSE_OPTIMIZER_BASE_URL 미설정 시 로컬 기본값(application.yml)으로 폴백
//  - OPTIMIZE_PATH("/optimize")는 실제 FastAPI 라우트가 정해지면 확인 필요한 placeholder
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
        private const val OPTIMIZE_PATH = "/optimize"
    }
}
