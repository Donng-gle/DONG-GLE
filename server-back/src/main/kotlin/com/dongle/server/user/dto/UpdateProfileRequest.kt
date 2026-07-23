package com.dongle.server.user.dto

import jakarta.validation.constraints.Size

data class UpdateProfileRequest(
    @field:Size(max = 50)
    val nickname: String? = null,
    val profileImageUrl: String? = null,
)
