package com.dongle.server.user

import org.springframework.data.jpa.repository.JpaRepository

interface UserPreferenceRepository : JpaRepository<UserPreference, Long> {

    fun findByUserId(userId: Long): List<UserPreference>

    fun findByUserIdAndTag(userId: Long, tag: String): UserPreference?

    fun deleteAllByUserId(userId: Long)
}
