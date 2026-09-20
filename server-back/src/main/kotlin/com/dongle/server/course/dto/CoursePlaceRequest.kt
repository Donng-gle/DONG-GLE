package com.dongle.server.course.dto

import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotNull

data class CoursePlaceRequest(
    @field:NotNull
    val placeId: Long?,

    @field:NotNull
    @field:Min(1)
    val visitOrder: Int?,

    val plannedTime: String? = null,

    // 여러 날 코스 지원(2026-09-06 결정, decision-log 참고) — "직접 코스 만들기"에서 이 장소가
    // 며칠째 방문지인지(YYYY-MM-DD). 없으면 날짜 구분 없는 코스로 저장됨
    val visitDate: String? = null,
)
