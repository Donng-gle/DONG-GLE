package com.dongle.server.auth

class InvalidRefreshTokenException : RuntimeException("유효하지 않거나 만료된 리프레시 토큰입니다.")
