package com.dongle.server.swipe.dto

import com.dongle.server.swipe.SwipeTransport
import java.time.LocalDate
import java.time.LocalDateTime

data class SwipeSessionDetailResponse(
    val sessionId: String,
    val expiresAt: LocalDateTime,
    val travelDate: LocalDate,
    val transport: SwipeTransport,
    // 아직 스와이프하지 않은 잔여 후보 목록
    val candidates: List<SwipeCandidateResponse>,
    // 이미 스와이프한 결과 목록 (화면 복원 시 처리된 카드를 건너뛰는 데 사용)
    val swipedResults: List<SwipedResultItemResponse>,
)
