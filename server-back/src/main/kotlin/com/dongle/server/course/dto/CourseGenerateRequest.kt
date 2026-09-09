package com.dongle.server.course.dto

import com.dongle.server.swipe.SwipeTransport
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import java.time.LocalDate
import java.time.LocalTime

data class CourseGenerateRequest(
    @field:NotBlank
    val sessionId: String? = null,

    @field:NotNull
    val travelDate: LocalDate? = null,

    @field:NotNull
    val transport: SwipeTransport? = null,

    // 둘 다 없으면 CourseService.DAY_START~DAY_END(09:00~21:00)로 폴백 — 프론트 "AI 일정 추천받기"
    // 세부사항 화면(TimePicker)에서 값을 안 고르면 안 보내는 선택 필드라 필수로 두지 않음.
    // endTime < startTime이면 CourseService에서 400(InvalidCourseTimeRangeException)
    val startTime: LocalTime? = null,
    val endTime: LocalTime? = null,
)
