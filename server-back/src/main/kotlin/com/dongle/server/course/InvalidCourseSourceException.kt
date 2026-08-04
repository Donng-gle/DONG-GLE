package com.dongle.server.course

class InvalidCourseSourceException : RuntimeException("코스 수정 시 source는 ai_edited 또는 user로만 변경할 수 있습니다.")
