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
    // 하트 아이콘 아래 숫자(찜 개수) — 이 필드가 아예 없어서 프론트가 대신 visitLogCount를 잘못
    // 바인딩해서 쓰고 있었고(찜을 눌러도 안 바뀌는 버그로 이어짐), 그래서 여기 추가함(2026-09-12,
    // 사용자 리포트). place에 별도 카운터 컬럼이 없어 place_like를 그때그때 count — 인덱스
    // (idx_place_like_place)가 있어 상세 페이지 1건 조회에 충분히 가벼움
    val likeCount: Long,
)
