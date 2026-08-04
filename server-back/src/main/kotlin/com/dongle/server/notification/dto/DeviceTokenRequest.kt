package com.dongle.server.notification.dto

import com.dongle.server.notification.DevicePlatform
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull

data class DeviceTokenRequest(
    @field:NotBlank
    val fcmToken: String,

    @field:NotNull
    val platform: DevicePlatform?,
)
