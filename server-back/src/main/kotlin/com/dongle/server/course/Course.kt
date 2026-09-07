package com.dongle.server.course

import com.dongle.server.swipe.SwipeTransport
import com.dongle.server.user.User
import jakarta.persistence.CascadeType
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
import jakarta.persistence.OneToMany
import jakarta.persistence.OrderBy
import jakarta.persistence.Table
import java.time.LocalDate
import java.time.LocalDateTime

@Entity
@Table(name = "course")
class Course(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    val user: User,

    @Column(nullable = false)
    var title: String,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var source: CourseSource,

    @Column(name = "travel_date")
    var travelDate: LocalDate? = null,

    // 여러 날 범위 지원(2026-09-06 결정, decision-log 참고) — "직접 코스 만들기"에서만 입력받음
    // (AI 코스 생성은 course_optimizer가 단일 날짜 전제라 계속 미사용). 장소 목록 자체는 날짜별로
    // 안 나뉘고 계속 하나의 순서 리스트(CoursePlace.visitOrder)임 — 범위는 표시/저장 용도만
    @Column(name = "end_date")
    var endDate: LocalDate? = null,

    // 구글맵 경로 재계산(GoogleRoutesClient)에 쓰는 이동수단. 과거 데이터/미입력 허용(nullable)
    @Enumerated(EnumType.STRING)
    @Column(nullable = true)
    var transport: SwipeTransport? = null,

    @Column(name = "created_at", nullable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(),

    @OneToMany(mappedBy = "course", fetch = FetchType.LAZY, cascade = [CascadeType.ALL], orphanRemoval = true)
    @OrderBy("visitOrder asc")
    val places: MutableList<CoursePlace> = mutableListOf(),
)
