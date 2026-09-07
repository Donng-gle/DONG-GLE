package com.dongle.server.course.dto

import com.dongle.server.swipe.SwipeTransport
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import java.time.LocalDate

data class CourseGenerateRequest(
    @field:NotBlank
    val sessionId: String? = null,

    @field:NotNull
    val travelDate: LocalDate? = null,

    @field:NotNull
    val transport: SwipeTransport? = null,
)
