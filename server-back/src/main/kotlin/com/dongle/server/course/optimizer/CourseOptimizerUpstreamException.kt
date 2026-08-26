package com.dongle.server.course.optimizer

class CourseOptimizerUpstreamException(cause: Throwable) :
    RuntimeException("AI 코스 최적화 서비스 호출에 실패했습니다.", cause)
