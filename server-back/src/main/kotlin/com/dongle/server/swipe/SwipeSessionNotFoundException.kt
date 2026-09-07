package com.dongle.server.swipe

class SwipeSessionNotFoundException(sessionId: String) :
    RuntimeException("스와이프 세션을 찾을 수 없습니다. sessionId=$sessionId")
