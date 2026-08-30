package com.dongle.server.common.config

import org.springframework.boot.context.properties.ConfigurationProperties

// ai/place_recommender를 감싼 FastAPI 서비스(ai/api/app.py) 주소. course-optimizer(CourseOptimizerProperties)와
// 실제로는 같은 프로세스/호스트지만, 두 기능이 별개로 머지돼 온 이력이 있어 우선 별도 설정 키로 분리해둠
// (배포 시 두 base-url을 반드시 같은 값으로 맞춰야 함 — decision-log 참고, 나중에 하나로 통합 검토 가능)
@ConfigurationProperties(prefix = "place-recommender")
data class PlaceRecommenderProperties(
    val baseUrl: String,
)
