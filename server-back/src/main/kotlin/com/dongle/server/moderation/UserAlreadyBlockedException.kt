package com.dongle.server.moderation

class UserAlreadyBlockedException(blockedUserId: Long) :
    RuntimeException("이미 차단한 사용자입니다. blockedUserId=$blockedUserId")
