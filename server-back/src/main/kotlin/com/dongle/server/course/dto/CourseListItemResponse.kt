package com.dongle.server.course.dto

import java.time.LocalDate
import java.time.LocalDateTime

data class CourseListItemResponse(
    val id: Long,
    val title: String,
    val travelDate: LocalDate?,
    // 여러 날 범위 지원(2026-09-06 결정, decision-log 참고) — "직접 코스 만들기"에서만 채워짐
    val endDate: LocalDate?,
    val source: String,
    val placeCount: Int,
    val thumbnailUrl: String?,
    // 스크랩북 카드의 장소 썸네일 스트립(방문 순서 기준 최대 3장)+"N+" 배지에 씀
    // (2026-09-05 추가, decision-log 참고). placeCount가 이 배열 길이보다 크면 그 차이가 "N+"
    val placeThumbnails: List<String>,
    val createdAt: LocalDateTime,
)
