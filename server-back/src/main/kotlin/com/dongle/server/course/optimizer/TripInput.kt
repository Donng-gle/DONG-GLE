package com.dongle.server.course.optimizer

import java.time.LocalDateTime

// ai/course_optimizer.models.TripInput과 1:1 대응하는 요청 계약.
// 후보 장소를 어떻게 고를지(candidates 채우는 로직)는 이 클라이언트의 책임이 아님 —
// course_optimizer.md 자체가 "사용자 취향 기반 장소 추천 로직"을 명시적으로 구현 범위 밖에 둠
data class TripInput(
    val startTime: LocalDateTime,
    val endTime: LocalDateTime,
    val transportMode: TransportMode,
    val origin: LatLng,
    val fixedDestination: LatLng? = null,
    val candidates: List<CandidatePlace>,
)
