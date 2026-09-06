package com.dongle.server.visitlog.dto

import jakarta.validation.Valid
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.Size
import java.time.LocalDateTime

data class VisitLogCreateRequest(
    // 여러 장 지원(2026-09-06 결정) — 목록 순서를 그대로 sort_order로 저장. 사진별 캡션 지원
    // (2026-09-07 결정, decision-log 참고)으로 URL 문자열 목록에서 URL+캡션 객체 목록으로 변경
    @field:Valid
    @field:Size(max = 10)
    val photos: List<VisitLogPhotoRequest>? = null,

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
