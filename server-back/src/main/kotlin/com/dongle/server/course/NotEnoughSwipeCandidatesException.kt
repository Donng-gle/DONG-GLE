package com.dongle.server.course

// ai/course_optimizer의 최소 방문 개수(config.min_visit_count, 기본 2) 미만이면 애초에 코스를 만들 수 없어
// AI 서비스까지 호출하지 않고 여기서 먼저 걸러낸다
class NotEnoughSwipeCandidatesException(count: Int) :
    RuntimeException("코스를 만들기엔 좋아요/필수 표시한 장소가 부족합니다 (count=$count)")
