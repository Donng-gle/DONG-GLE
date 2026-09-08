package com.dongle.server.visitlog.dto

import jakarta.validation.Valid
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import java.time.LocalDateTime

// 나의 일지 "기록하기"에서 장소를 2개 이상 골랐을 때 — 코스(source='journal') + 장소마다
// visit_log를 한 번에 생성. 장소 1개면 프론트가 기존 POST /places/{placeId}/logs를 그대로 씀
// (2026-09-08 결정, decision-log 참고)
data class VisitLogCourseCreateRequest(
    @field:Valid
    @field:Size(min = 2, max = 20)
    val places: List<VisitLogCoursePlaceRequest>,

    // 생략하면 방문일 기준으로 자동 생성 (VisitLogService.defaultCourseTitle 참고)
    @field:Size(max = 200)
    val courseTitle: String? = null,
)

data class VisitLogCoursePlaceRequest(
    @field:NotNull
    val placeId: Long? = null,

    @field:Valid
    @field:Size(max = 10)
    val photos: List<VisitLogPhotoRequest>? = null,

    @field:Size(max = 50)
    val title: String? = null,

    @field:Size(max = 100)
    val oneLine: String? = null,

    @field:Size(max = 20)
    val weather: String? = null,

    @field:Min(1)
    @field:Max(5)
    val rating: Int? = null,

    val visitedAt: LocalDateTime? = null,
)
