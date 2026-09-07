package com.dongle.server.course.dto

import com.dongle.server.swipe.SwipeTransport
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Size
import java.time.LocalDate

data class CourseManualRequest(
    @field:NotBlank
    @field:Size(max = 200)
    val title: String,

    val travelDate: LocalDate? = null,

    // 여러 날 범위 지원(2026-09-06 결정, decision-log 참고) — travelDate(시작일)보다 이전이면
    // CourseService에서 InvalidCourseDateRangeException(400)
    val endDate: LocalDate? = null,

    // 구글맵 경로 재계산에 쓸 이동수단. 없으면 GET /courses/{courseId} 조회 시 기본값(walk)으로 계산
    val transport: SwipeTransport? = null,

    @field:NotEmpty
    val places: List<@Valid CoursePlaceRequest>,
)
