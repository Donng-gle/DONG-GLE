package com.dongle.server.course.dto

// api_1.3.1v.yaml 스펙은 candidates를 최대 3개까지 반환하도록 정의하지만(minItems: 1, maxItems: 3),
// ai/course_optimizer는 최적 경로 1개만 반환할 수 있어(백트래킹이 k별 최고점 1개만 유지) 지금은 항상 1개만 채운다.
// 3개 후보 생성은 course_optimizer 알고리즘 자체의 확장이 필요해 별도 논의 대상 (decision-log 참고)
data class CourseGenerateResponse(
    val candidates: List<CourseCandidateResponse>,
)
