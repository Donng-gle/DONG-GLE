package com.dongle.server.place.dto

import java.time.LocalDate

// recent_logs(방문 기록 미리보기)는 VisitLog 기능 구현 후 추가 예정 (API 명세 대비 M1 범위 밖)
data class PlaceDetailResponse(
    val id: Long,
    val contentId: String,
    val name: String,
    val category: String,
    val addr1: String?,
    val addr2: String?,
    val lat: Double?,
    val lng: Double?,
    val tel: String?,
    val mainImageUrl: String?,
    val overview: String?,
    val homepage: String?,
    val eventStartDate: LocalDate?,
    val eventEndDate: LocalDate?,
    val images: List<PlaceImageResponse>,
    val hours: List<PlaceHoursResponse>,
    val topTags: List<String>,
    val visitLogCount: Int,
    // 방문 기록에 남긴 별점(1~5, 선택 입력)의 평균. 아무도 별점을 안 남겼으면 null
    // (2026-09-05 추가, decision-log 참고 — Figma 상세 페이지의 "★★★★☆ 4.0"에 대응)
    val avgRating: Double?,
    val isLiked: Boolean?,
)
