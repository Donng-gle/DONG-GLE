package com.dongle.server.moderation

// 신고 사유 4종(2026-09-14 사용자 확정 스펙) — 프론트 신고 사유 선택 시트와 1:1 매칭
enum class ReportReason {
    inappropriate, spam, abuse, other
}
