package com.dongle.server.course.dto

import com.dongle.server.course.CourseSource
import com.dongle.server.swipe.SwipeTransport
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import java.time.LocalDate

data class CourseSaveRequest(
    val candidateId: String? = null,

    @field:NotBlank
    @field:Size(max = 200)
    val title: String,

    val travelDate: LocalDate? = null,

    // 구글맵 경로 재계산에 쓸 이동수단. 없으면 GET /courses/{courseId} 조회 시 기본값(walk)으로 계산
    val transport: SwipeTransport? = null,

    @field:NotNull
    val source: CourseSource?,

    @field:NotEmpty
    val places: List<@Valid CoursePlaceRequest>,
)
