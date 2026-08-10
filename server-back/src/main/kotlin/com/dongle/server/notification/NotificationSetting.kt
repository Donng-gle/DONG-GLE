package com.dongle.server.notification

import com.dongle.server.user.User
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.OneToOne
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "notification_setting")
class NotificationSetting(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    val user: User,

    // 외부에 노출되는 서비스라 기본값은 미동의(false). event_alert/course_reminder는
    // push_enabled가 true로 바뀔 때만 실제로 발송에 반영됨
    @Column(name = "push_enabled", nullable = false)
    var pushEnabled: Boolean = false,

    @Column(name = "event_alert", nullable = false)
    var eventAlert: Boolean = true,

    @Column(name = "course_reminder", nullable = false)
    var courseReminder: Boolean = true,

    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(),
)
