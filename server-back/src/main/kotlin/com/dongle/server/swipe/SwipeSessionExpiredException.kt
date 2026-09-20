package com.dongle.server.swipe

// api_1.3.1v.yaml 예시가 code: SESSION_EXPIRED를 명시적으로 고정해뒀음 (GlobalExceptionHandler 참고)
class SwipeSessionExpiredException :
    RuntimeException("스와이프 세션이 만료되었습니다. 다시 시작해주세요.")
