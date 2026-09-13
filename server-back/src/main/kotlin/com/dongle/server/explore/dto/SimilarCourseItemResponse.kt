package com.dongle.server.explore.dto

import java.time.LocalDate

// 코스 안 장소 하나의 미리보기(이름+썸네일) — "취향 맞춤 코스" 카드에서 사진을 넘기면 그 장소
// 이름으로 설명 텍스트가 바뀌게 하기 위한 쌍(2026-09-07 결정, decision-log 참고).
// CourseListItemResponse.placeThumbnails(URL만)와 달리 이름까지 같이 내려줌
data class SimilarCoursePlacePreview(
    val name: String,
    val thumbnailUrl: String?,
)

data class SimilarCourseItemResponse(
    val courseId: Long,
    val title: String,
    val travelDate: LocalDate?,
    val endDate: LocalDate?,
    val placeCount: Int,
    // 카드 사진 캐러셀용 — 방문 순서 기준 최대 몇 장만(SCRAPBOOK_THUMBNAIL_LIMIT과 동일 기준).
    // 실제 경로(지도 미리보기)나 전체 장소 좌표는 이 목록에 없음 — "선택" 시
    // GET /explore/courses/{courseId}(CourseDetailResponse)를 따로 불러서 씀(2026-09-07 결정)
    val placePreviews: List<SimilarCoursePlacePreview>,
    val nickname: String,
    val profileImageUrl: String?,
    // 신고/차단 대상을 특정하려면 작성자 식별자가 필요해서 추가(2026-09-14, 앱스토어 심사
    // 가이드라인 1.2 대응)
    val authorUserId: Long,
)
