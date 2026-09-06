package com.dongle.server.visitlog.dto

import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.Size
import java.time.LocalDateTime

data class VisitLogCreateRequest(
    // 여러 장 지원(2026-09-06 결정, decision-log 참고) — 목록 순서를 그대로 sort_order로 저장.
    // 이전엔 photoUrl 단일 문자열이었음
    @field:Size(max = 10)
    val photoUrls: List<String>? = null,

    @field:Size(max = 50)
    val title: String? = null,

    @field:Size(max = 100)
    val oneLine: String? = null,

    @field:Size(max = 20)
    val weather: String? = null,

    @field:Min(1)
    @field:Max(5)
    val rating: Int? = null,

    val visitedAt: LocalDateTime? = null,
)
