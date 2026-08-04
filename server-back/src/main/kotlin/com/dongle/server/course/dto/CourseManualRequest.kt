package com.dongle.server.course.dto

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

    // 이동수단(차/도보/대중교통)은 구글맵 경로 재계산 도입 시 사용 예정. 현재는 저장하지 않음.
    val transport: String? = null,

    @field:NotEmpty
    val places: List<@Valid CoursePlaceRequest>,
)
