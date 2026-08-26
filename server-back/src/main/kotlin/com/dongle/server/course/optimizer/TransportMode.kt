package com.dongle.server.course.optimizer

// ai/course_optimizer.models.TripInput.transport_mode: Literal["walk", "transit", "car"]와 동일한 값 사용.
// 코스 CRUD의 CourseSource(ai/ai_edited/user)처럼 소문자 상수명을 그대로 와이어 값으로 사용하는 컨벤션을 따름
//
// 주의: api_1.3.1v.yaml의 CourseGenerateRequest.transport는 [car, walk, public] 3개 값을 쓰는 옛 스펙이라
// 이 enum(walk/transit/car)과 값이 다름 (특히 public ≠ transit). /courses/generate 공개 계약을 이 클라이언트에
// 연결할 때 매핑이 필요함 — 지금은 course_optimizer 쪽 계약만 그대로 미러링한 상태 (decision-log 참고 예정)
enum class TransportMode { walk, transit, car }
