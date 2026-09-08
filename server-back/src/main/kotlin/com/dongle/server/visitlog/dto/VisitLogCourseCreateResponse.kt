package com.dongle.server.visitlog.dto

data class VisitLogCourseCreateResponse(
    val courseId: Long,
    val logs: List<VisitLogDetailResponse>,
)
