package com.dongle.server.common.config

import org.springframework.boot.context.properties.ConfigurationProperties

// ai/course_optimizer + ai/place_recommender를 함께 감싼 단일 FastAPI 서비스(김지광, EC2+Docker 배포) 주소.
// 예전엔 course-optimizer.base-url / place-recommender.base-url로 나뉘어 있었으나(배포 전 두 기능이
// 별개로 머지돼 온 이력 때문), 실제 배포가 한 호스트/한 프로세스로 확정되면서 하나로 통합함
// (2026-09-01 결정, decision-log 참고). CourseOptimizerHttpConfig/PlaceRecommenderHttpConfig 둘 다
// 이 프로퍼티를 baseUrl로 사용 — RestClient 빈 자체는 여전히 클라이언트별로 분리 유지(원인: 8/30
// "@Primary RestClient 여러 개 섞이는 문제" 재발 방지, decision-log 참고)
@ConfigurationProperties(prefix = "ai-server")
data class AiServerProperties(
    val baseUrl: String,
)
