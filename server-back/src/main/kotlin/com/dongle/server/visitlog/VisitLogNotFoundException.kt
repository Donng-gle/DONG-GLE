package com.dongle.server.visitlog

class VisitLogNotFoundException(logId: Long) : RuntimeException("여행 기록을 찾을 수 없습니다. logId=$logId")
