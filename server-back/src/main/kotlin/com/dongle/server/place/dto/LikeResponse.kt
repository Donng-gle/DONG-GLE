package com.dongle.server.place.dto

data class LikeResponse(
    val isLiked: Boolean,
    // 찜 토글 직후 최신 찜 개수 — 프론트가 하트 아래 숫자를 낙관적으로 어긋나게 증감시키지 않고
    // 이 값을 그대로 반영하면 됨(2026-09-12, PlaceDetailResponse.likeCount와 같은 이유)
    val likeCount: Long,
)
