package com.dongle.server.course.dto

import java.time.LocalDate
import java.time.LocalDateTime

data class CourseListItemResponse(
    val id: Long,
    val title: String,
    val travelDate: LocalDate?,
    val source: String,
    val placeCount: Int,
    val thumbnailUrl: String?,
    val createdAt: LocalDateTime,
)
