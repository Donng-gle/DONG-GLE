package com.dongle.server.auth

class InvalidOAuthCodeException(provider: String) : RuntimeException("유효하지 않은 인가 코드입니다. provider=$provider")
