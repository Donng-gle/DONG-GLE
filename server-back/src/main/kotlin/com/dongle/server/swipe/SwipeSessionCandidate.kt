package com.dongle.server.swipe

import com.dongle.server.place.Place
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.LocalDateTime

// action이 null이면 발급 시점 이후 아직 스와이프하지 않은 잔여 후보, 값이 있으면 제출된 결과.
// sortOrder는 발급 시점의 추천 순위를 그대로 보존 (앱 복귀 시 동일한 순서로 복원하기 위함)
@Entity
@Table(name = "swipe_session_candidate")
class SwipeSessionCandidate(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    val session: SwipeSession,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "place_id", nullable = false)
    val place: Place,

    @Column(name = "sort_order", nullable = false)
    val sortOrder: Int,

    @Enumerated(EnumType.STRING)
    @Column(nullable = true)
    var action: SwipeAction? = null,

    @Column(name = "swiped_at")
    var swipedAt: LocalDateTime? = null,
)
