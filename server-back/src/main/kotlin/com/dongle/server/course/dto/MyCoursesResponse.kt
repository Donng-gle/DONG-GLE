package com.dongle.server.course.dto

import com.dongle.server.common.PaginationMeta

data class MyCoursesResponse(
    val courses: List<CourseListItemResponse>,
    val meta: PaginationMeta,
)
