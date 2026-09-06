package com.dongle.server.course

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
import java.time.LocalDate
import java.time.LocalTime

@Entity
@Table(name = "course_place")
class CoursePlace(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_id", nullable = false)
    val course: Course,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "place_id", nullable = false)
    val place: Place,

    // 코스 전체를 통틀은 전역 순서(날짜가 바뀌어도 계속 이어짐) — 여러 날 코스도 하나의 순서
    // 리스트라는 기존 전제를 유지. 날짜별 그룹핑은 visitDate로 함(2026-09-06 결정, decision-log 참고)
    @Column(name = "visit_order", nullable = false)
    var visitOrder: Int,

    @Column(name = "planned_time")
    var plannedTime: LocalTime? = null,

    // 이 장소가 코스의 며칠째 방문지인지(N박N일 여러 날 코스 지원, 2026-09-06 결정, decision-log
    // 참고) — "직접 코스 만들기"에서만 채워짐. null이면 날짜 구분 없는 기존 코스(AI 코스, 과거
    // 데이터)이거나 하루짜리 코스(항상 course.travelDate와 같음). course.travelDate~endDate
    // 범위 밖이면 CourseService가 400(InvalidCourseDateRangeException)
    @Column(name = "visit_date")
    var visitDate: LocalDate? = null,
)
