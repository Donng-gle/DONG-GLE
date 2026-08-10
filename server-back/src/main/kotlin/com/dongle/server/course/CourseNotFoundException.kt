package com.dongle.server.course

class CourseNotFoundException(courseId: Long) : RuntimeException("코스를 찾을 수 없습니다. courseId=$courseId")
