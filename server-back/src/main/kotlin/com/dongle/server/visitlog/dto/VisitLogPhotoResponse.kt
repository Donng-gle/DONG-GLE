package com.dongle.server.visitlog.dto

// 사진 1장 + 캡션(선택). VisitLog 자신의 응답(Detail/Summary/MapItem)뿐 아니라 explore 패키지의
// SimilarLogItemResponse에서도 재사용 — "취향 맞춤 코스" 카드가 사진을 넘기면 그 사진에 달린
// 글로 바뀌어야 해서(2026-09-07 결정, decision-log 참고) 캡션까지 필요해짐
data class VisitLogPhotoResponse(
    val url: String,
    val caption: String?,
)
