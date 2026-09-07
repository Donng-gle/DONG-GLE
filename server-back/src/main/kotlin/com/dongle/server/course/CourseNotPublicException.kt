package com.dongle.server.course

// "취향 맞춤 코스" 탐색(explore/courses/{courseId})에서 비공개 코스에 접근했을 때 — 소유자가 아니어서
// 막는 CourseAccessDeniedException과는 별개 사유라 메시지를 분리(2026-09-07 결정, decision-log 참고)
class CourseNotPublicException : RuntimeException("공개되지 않은 코스입니다.")
