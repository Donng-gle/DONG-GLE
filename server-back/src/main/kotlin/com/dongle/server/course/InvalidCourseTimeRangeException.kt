package com.dongle.server.course

class InvalidCourseTimeRangeException :
    RuntimeException("종료 시간은 시작 시간보다 이전일 수 없습니다.")
