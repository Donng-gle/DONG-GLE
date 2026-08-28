package com.dongle.server.course.dto

import com.dongle.server.course.CourseSource
import jakarta.validation.Valid
import jakarta.validation.constraints.Size

data class CourseUpdateRequest(
    @field:Size(max = 200)
    val title: String? = null,

    val source: CourseSource? = null,

    val places: List<@Valid CoursePlaceRequest>? = null,
)
