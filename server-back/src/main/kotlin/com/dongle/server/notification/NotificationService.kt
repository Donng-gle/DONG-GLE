package com.dongle.server.notification

import com.dongle.server.notification.dto.DeviceTokenRequest
import com.dongle.server.notification.dto.NotificationSettingRequest
import com.dongle.server.notification.dto.NotificationSettingResponse
import com.dongle.server.user.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Service
@Transactional(readOnly = true)
class NotificationService(
    private val notificationSettingRepository: NotificationSettingRepository,
    private val deviceTokenRepository: DeviceTokenRepository,
    private val userRepository: UserRepository,
) {
    @Transactional
    fun getSettings(userId: Long): NotificationSettingResponse =
        findOrCreateSettings(userId).toResponse()

    @Transactional
    fun updateSettings(userId: Long, request: NotificationSettingRequest): NotificationSettingResponse {
        val settings = findOrCreateSettings(userId)
        settings.pushEnabled = requireNotNull(request.pushEnabled)
        settings.eventAlert = requireNotNull(request.eventAlert)
        settings.courseReminder = requireNotNull(request.courseReminder)
        settings.updatedAt = LocalDateTime.now()
        return settings.toResponse()
    }

    @Transactional
    fun registerDeviceToken(userId: Long, request: DeviceTokenRequest) {
        val platform = requireNotNull(request.platform)
        val existing = deviceTokenRepository.findByUserIdAndPlatform(userId, platform)

        if (existing != null) {
            existing.fcmToken = request.fcmToken
            existing.updatedAt = LocalDateTime.now()
        } else {
            deviceTokenRepository.save(
                DeviceToken(
                    user = userRepository.getReferenceById(userId),
                    platform = platform,
                    fcmToken = request.fcmToken,
                )
            )
        }
    }

    private fun findOrCreateSettings(userId: Long): NotificationSetting =
        notificationSettingRepository.findByUserId(userId)
            ?: notificationSettingRepository.save(
                NotificationSetting(user = userRepository.getReferenceById(userId))
            )
}

private fun NotificationSetting.toResponse() = NotificationSettingResponse(
    pushEnabled = pushEnabled,
    eventAlert = eventAlert,
    courseReminder = courseReminder,
)
