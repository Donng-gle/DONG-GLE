package com.dongle.server.course

// journal: 나의 일지 "기록하기"에서 장소 2개 이상을 골라 사후 생성된 코스 (2026-09-08 결정, decision-log 참고)
// liked: "취향 맞춤 코스" 탭에서 다른 사용자의 공개 코스를 하트로 내 스크랩북에 복제 저장한 코스
// (2026-09-11 추가) — 스크랩북 화면이 이 값으로 "나의 코스"/"여행코스" 탭을 구분함
enum class CourseSource { ai, ai_edited, user, journal, liked }
