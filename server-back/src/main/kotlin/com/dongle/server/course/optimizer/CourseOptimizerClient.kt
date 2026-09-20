package com.dongle.server.course.optimizer

import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import org.springframework.web.client.RestClientResponseException

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
            // GlobalExceptionHandler가 CourseOptimizerUpstreamException을 502로만 변환하고 원인은
            // 로깅하지 않아서, 연결 실패/타임아웃/AI 서버가 4xx로 거절한 것 중 뭔지 로그로 전혀
            // 구분이 안 됐음(2026-09-12, 실기기 재현 시 Render 로그에 흔적이 아예 없었음 — 사용자
            // 리포트). 특히 위 "미검증 사항"의 LocalDateTime 직렬화 포맷 불일치라면 AI 서버가 422로
            // 거절하면서 본문에 Pydantic validation 에러를 실어 보낼 가능성이 커서, 그 응답 본문까지
            // 같이 남겨야 원인이 보임
            if (e is RestClientResponseException) {
                logger.error(
                    "AI 코스 최적화 서비스 호출 실패 (status=${e.statusCode}, body=${e.responseBodyAsString}, input=$input)",
                    e,
                )
            } else {
                logger.error("AI 코스 최적화 서비스 호출 실패 (input=$input)", e)
            }
            throw CourseOptimizerUpstreamException(e)
        }

    companion object {
        private val logger = LoggerFactory.getLogger(CourseOptimizerClient::class.java)
        private const val OPTIMIZE_PATH = "/v1/courses/optimize"
    }
}
