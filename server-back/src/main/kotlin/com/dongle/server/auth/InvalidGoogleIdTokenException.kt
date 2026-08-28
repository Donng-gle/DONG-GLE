package com.dongle.server.auth

class InvalidGoogleIdTokenException(reason: String) :
    RuntimeException("유효하지 않은 구글 ID 토큰입니다. reason=$reason")
