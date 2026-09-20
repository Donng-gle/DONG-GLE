package com.dongle.server.moderation.dto

import jakarta.validation.constraints.NotNull

data class BlockUserRequest(
    @field:NotNull
    val blockedUserId: Long?,
)
