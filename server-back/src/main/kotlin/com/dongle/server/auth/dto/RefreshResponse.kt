package com.dongle.server.auth.dto

data class RefreshResponse(
    val accessToken: String,
    // 리프레시 토큰 회전(2026-09-04 도입, decision-log 참고) — 매 갱신마다 새 리프레시 토큰을 발급하고
    // 기존 토큰은 즉시 폐기함. 클라이언트는 이 값으로 저장된 리프레시 토큰을 반드시 교체해야 함
    val refreshToken: String,
)
