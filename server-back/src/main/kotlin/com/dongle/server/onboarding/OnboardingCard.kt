package com.dongle.server.onboarding

import com.dongle.server.place.Place
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "onboarding_card")
class OnboardingCard(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "place_id")
    val place: Place? = null,

    @Column(name = "image_url", nullable = false)
    val imageUrl: String,

    @Column(name = "is_seed", nullable = false)
    val isSeed: Boolean = false,

    @Column(nullable = false)
    val relaxing: Double = 0.0,

    @Column(nullable = false)
    val lively: Double = 0.0,

    @Column(nullable = false)
    val romantic: Double = 0.0,

    @Column(nullable = false)
    val local: Double = 0.0,

    @Column(nullable = false)
    val photogenic: Double = 0.0,

    @Column(nullable = false)
    val traditional: Double = 0.0,

    @Column(nullable = false)
    val modern: Double = 0.0,

    @Column(name = "created_at", nullable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
) {
    val displayName: String
        get() = place?.name ?: "감성 카드"

    fun toVector(): EmotionVector = EmotionVector(
        relaxing = relaxing,
        lively = lively,
        romantic = romantic,
        local = local,
        photogenic = photogenic,
        traditional = traditional,
        modern = modern,
    )
}
