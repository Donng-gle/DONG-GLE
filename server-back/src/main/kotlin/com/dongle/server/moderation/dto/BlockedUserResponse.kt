package com.dongle.server.moderation.dto

import java.time.LocalDateTime

data class BlockedUserResponse(
    val userId: Long,
    val nickname: String,
    val profileImageUrl: String?,
    val createdAt: LocalDateTime,
)

data class BlockedUsersResponse(
    val users: List<BlockedUserResponse>,
)
