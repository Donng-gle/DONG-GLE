package com.dongle.server.moderation

// 다른 사용자에게 노출되는 UGC 지점 기준 — ExploreScreen(비슷한 취향 탐색/취향 맞춤 코스),
// 관광지 상세 리뷰 카드에서 신고 가능한 대상 (2026-09-14 도입)
enum class ReportTargetType {
    visit_log, course
}
