package com.dongle.server.notification

import org.springframework.data.jpa.repository.JpaRepository

interface NotificationSettingRepository : JpaRepository<NotificationSetting, Long> {

    fun findByUserId(userId: Long): NotificationSetting?
}
