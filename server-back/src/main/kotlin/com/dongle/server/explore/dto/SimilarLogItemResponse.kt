package com.dongle.server.explore.dto

data class SimilarLogItemResponse(
    val logId: Long,
    val placeId: Long,
    val placeName: String,
    val lat: Double?,
    val lng: Double?,
    val photoUrl: String?,
    val oneLine: String?,
    val tags: List<String>,
    // Figma "취향 비슷 사용자 프로필"(507:10963) 카드에 작성자 닉네임+아바타가 있어서 추가 (2026-09-03, decision-log 참고)
    val nickname: String,
    val profileImageUrl: String?,
)
