package com.dongle.server.notification.dto

data class NotificationSettingResponse(
    val pushEnabled: Boolean,
    val eventAlert: Boolean,
    val courseReminder: Boolean,
)
