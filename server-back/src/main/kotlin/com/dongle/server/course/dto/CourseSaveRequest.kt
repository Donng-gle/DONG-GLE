package com.dongle.server.course.dto

import com.dongle.server.course.CourseSource
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

    @field:NotNull
    val source: CourseSource?,

    @field:NotEmpty
    val places: List<@Valid CoursePlaceRequest>,
)
