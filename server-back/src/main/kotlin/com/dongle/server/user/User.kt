package com.dongle.server.user

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "`user`")
class User(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "user_id", nullable = false, unique = true)
    val userId: String,

    @Column(nullable = false)
    var nickname: String,

    var email: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "oauth_provider", nullable = false)
    val oauthProvider: OAuthProvider,

    @Column(name = "oauth_id", nullable = false)
    val oauthId: String,

    @Column(name = "profile_image_url")
    var profileImageUrl: String? = null,

    @Column(name = "has_onboarded", nullable = false)
    var hasOnboarded: Boolean = false,

    @Column(name = "created_at", nullable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
)
