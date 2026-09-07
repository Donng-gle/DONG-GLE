package com.dongle.server.swipe

// api_1.3.1v.yaml SwipeCandidatesRequest.transport / CourseGenerateRequest.transport와 동일한 값.
// 주의: ai/course_optimizer.models.TripInput.transport_mode(walk/transit/car)와는 값 자체가 다름
// (특히 public ≠ transit) — 이 스와이프 계약과 course_optimizer 계약을 잇는 지점에서 매핑 필요
// (feat/course-optimizer-client의 TransportMode 주석 참고)
// `public`은 Kotlin 예약어라 백틱으로 이스케이프 필요. Jackson 직렬화 값 자체는 여전히 "public" 문자열로 나감
enum class SwipeTransport { car, walk, `public` }
