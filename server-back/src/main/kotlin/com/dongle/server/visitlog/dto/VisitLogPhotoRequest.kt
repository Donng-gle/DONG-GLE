package com.dongle.server.visitlog.dto

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

// 사진 1장 + 그 사진에 대한 캡션(선택). 여러 장 지원 때(2026-09-06)는 URL 문자열 목록이었는데,
// 사진별 캡션 지원(2026-09-07 결정, decision-log 참고)으로 각 사진이 자기 캡션을 들고 다녀야 해서
// 객체 목록으로 바꿈
data class VisitLogPhotoRequest(
    @field:NotBlank
    val url: String,

    @field:Size(max = 100)
    val caption: String? = null,
)
