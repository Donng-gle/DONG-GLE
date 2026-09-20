package com.dongle.server.explore.dto

import com.dongle.server.visitlog.dto.VisitLogPhotoResponse

data class SimilarLogItemResponse(
    val logId: Long,
    val placeId: Long,
    val placeName: String,
    val lat: Double?,
    val lng: Double?,
    // 여러 장 사진 확장은 처음엔 범위 밖이었는데(2026-09-06 결정), "취향 맞춤 코스" 카드에서
    // 사진을 넘기면 그 사진에 달린 글로 바뀌어야 해서(2026-09-07 결정, decision-log 참고)
    // 대표 사진 1장(photoUrl)에서 전체 목록+캡션(photos)으로 확장
    val photos: List<VisitLogPhotoResponse>,
    val oneLine: String?,
    val rating: Int?,
    val tags: List<String>,
    // Figma "취향 비슷 사용자 프로필"(507:10963) 카드에 작성자 닉네임+아바타가 있어서 추가 (2026-09-03, decision-log 참고)
    val nickname: String,
    val profileImageUrl: String?,
    // 신고/차단 대상을 특정하려면 작성자 식별자가 필요해서 추가(2026-09-14, 앱스토어 심사
    // 가이드라인 1.2 대응)
    val authorUserId: Long,
)
