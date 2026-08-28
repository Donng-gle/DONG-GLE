package com.dongle.server.visitlog

import com.dongle.server.place.Place
import com.dongle.server.user.User
import jakarta.persistence.CascadeType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.OneToMany
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "visit_log")
class VisitLog(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    val user: User,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "place_id", nullable = false)
    val place: Place,

    @Column(name = "photo_url")
    var photoUrl: String? = null,

    @Column(name = "one_line")
    var oneLine: String? = null,

    @Column(name = "is_public", nullable = false)
    var isPublic: Boolean = true,

    @Column(name = "visited_at", nullable = false)
    var visitedAt: LocalDateTime = LocalDateTime.now(),

    @OneToMany(mappedBy = "visitLog", fetch = FetchType.LAZY, cascade = [CascadeType.ALL], orphanRemoval = true)
    val emotionTags: MutableList<LogEmotionTag> = mutableListOf(),
)
