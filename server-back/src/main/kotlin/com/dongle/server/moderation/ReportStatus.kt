package com.dongle.server.moderation

// 이 프로젝트 규모(어드민 패널 없음)에 맞춘 최소 모더레이션 상태 — 운영자가 DB를 직접 보고
// pending을 확인해 reviewed/rejected로 갱신하거나, 문제 콘텐츠의 is_public을 직접 끄는 수동
// 대응 방식을 전제로 함(2026-09-14, decision-log 참고 예정)
enum class ReportStatus {
    pending, reviewed, rejected
}
