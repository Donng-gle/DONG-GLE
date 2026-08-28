package com.dongle.server.notification

import org.springframework.data.jpa.repository.JpaRepository

interface DeviceTokenRepository : JpaRepository<DeviceToken, Long> {

    fun findByUserIdAndPlatform(userId: Long, platform: DevicePlatform): DeviceToken?
}
