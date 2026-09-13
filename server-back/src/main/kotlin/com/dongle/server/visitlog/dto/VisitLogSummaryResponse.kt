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
    // 신고/차단 대상을 특정하려면 작성자 식별자가 필요해서 추가(2026-09-14, 앱스토어 심사
    // 가이드라인 1.2 대응)
    val authorUserId: Long,
)
