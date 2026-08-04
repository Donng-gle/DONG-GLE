package com.dongle.server.notification.dto

import jakarta.validation.constraints.NotNull

data class NotificationSettingRequest(
    @field:NotNull
    val pushEnabled: Boolean?,

    @field:NotNull
    val eventAlert: Boolean?,

    @field:NotNull
    val courseReminder: Boolean?,
)
