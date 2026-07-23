package com.dongle.server.user.dto

import java.time.LocalDateTime

data class UserProfileResponse(
    val id: Long,
    val nickname: String,
    val profileImageUrl: String?,
    val oauthProvider: String,
    val hasOnboarded: Boolean,
    val createdAt: LocalDateTime,
)
