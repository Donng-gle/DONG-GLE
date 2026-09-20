package com.dongle.server.visitlog.dto

import jakarta.validation.Valid
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.Size
import java.time.LocalDateTime

data class VisitLogUpdateRequest(
    @field:Size(max = 50)
    val title: String? = null,

    @field:Size(max = 100)
    val oneLine: String? = null,

    @field:Size(max = 20)
    val weather: String? = null,

    // oneLine과 달리 "지우기"용 빈 값 개념이 없어서(숫자엔 blank string 같은 게 없음) visitedAt처럼
    // 값을 보내면 갱신, 생략하면 그대로 둠 — 한 번 매긴 별점을 다시 null로 되돌리는 건 지원 안 함
    @field:Min(1)
    @field:Max(5)
    val rating: Int? = null,

    val visitedAt: LocalDateTime? = null,

    // 사진/장소 수정 지원(2026-09-12 결정, decision-log 참고) — "나의 일지" 수정 화면이 기존
    // "기록하기" 프레임을 재사용하면서 사진/장소도 같이 편집 가능해야 한다는 요청으로 추가.
    // photos는 부분 수정이 아니라 "보낸 목록으로 완전히 교체"(순서=sort_order로 그대로 저장) —
    // null이면 기존 사진 그대로 둠, 빈 리스트([])를 보내면 사진을 전부 지움(VisitLogCreateRequest와
    // 같은 VisitLogPhotoRequest 재사용)
    @field:Valid
    @field:Size(max = 10)
    val photos: List<VisitLogPhotoRequest>? = null,

    // 값을 보내면 그 장소로 재배정(예전/새 장소 visitLogCount를 서비스 레이어가 같이 조정),
    // 생략하면 기존 장소 그대로 둠
    val placeId: Long? = null,
)
