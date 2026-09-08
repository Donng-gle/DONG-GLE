package com.dongle.server.visitlog.dto

import java.time.LocalDateTime

data class VisitLogSummaryResponse(
    val id: Long,
    val photos: List<VisitLogPhotoResponse>,
    val title: String?,
    val oneLine: String?,
    val weather: String?,
    val rating: Int?,
    val visitedAt: LocalDateTime,
    val tags: List<String>,
    // 관광지 상세 페이지 리뷰 카드에 작성자 닉네임+아바타 표시(2026-09-09 결정, decision-log 참고).
    // ExploreService.toSimilarLogItemResponse의 nickname/profileImageUrl과 동일한 패턴
    val nickname: String,
    val profileImageUrl: String?,
)
