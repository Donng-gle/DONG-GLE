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
    val topTags: List<String>,
    val visitLogCount: Int,
    val isLiked: Boolean?,
)
