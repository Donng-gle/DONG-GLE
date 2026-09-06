package com.dongle.server.course

class InvalidCourseDateRangeException :
    RuntimeException("종료 날짜는 시작 날짜보다 이전일 수 없습니다.")
