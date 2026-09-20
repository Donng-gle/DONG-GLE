package com.dongle.server.auth

class InvalidAppleIdTokenException(reason: String) :
    RuntimeException("유효하지 않은 애플 ID 토큰입니다. reason=$reason")
