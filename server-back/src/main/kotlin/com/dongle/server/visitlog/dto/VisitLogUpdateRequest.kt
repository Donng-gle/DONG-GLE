package com.dongle.server.visitlog.dto

import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.Size
import java.time.LocalDateTime

data class VisitLogUpdateRequest(
    @field:Size(max = 50)
    val title: String? = null,

    @field:Size(max = 100)
    val oneLine: String? = null,

    @field:Size(max = 20)
    val weather: String? = null,

    // oneLine과 달리 "지우기"용 빈 값 개념이 없어서(숫자엔 blank string 같은 게 없음) visitedAt처럼
    // 값을 보내면 갱신, 생략하면 그대로 둠 — 한 번 매긴 별점을 다시 null로 되돌리는 건 지원 안 함
    @field:Min(1)
    @field:Max(5)
    val rating: Int? = null,

    val visitedAt: LocalDateTime? = null,
)
