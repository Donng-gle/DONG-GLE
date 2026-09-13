package com.dongle.server.moderation

class UserBlockNotFoundException(blockedUserId: Long) :
    RuntimeException("차단 기록이 없습니다. blockedUserId=$blockedUserId")
