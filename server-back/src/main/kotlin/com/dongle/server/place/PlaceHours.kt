package com.dongle.server.place

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.LocalTime

// Google Places opening_hours.periods 기준 + TourAPI 텍스트 파싱 보완 (데이터 파트 적재, 백엔드는 읽기 전용).
// open_day/close_day는 0=일요일 ~ 6=토요일 (Google 기준). close_day/closeTime이 null이면 해당 open_day는 24시간 영업.
// 브레이크타임 등 세부 휴게시간 데이터는 소스 어디에도 사실상 없어 미반영 (decision-log 참고)
@Entity
@Table(name = "place_hours")
class PlaceHours(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "place_id", nullable = false)
    val place: Place,

    @Column(name = "open_day", nullable = false)
    val openDay: Int,

    @Column(name = "open_time", nullable = false)
    val openTime: LocalTime,

    @Column(name = "close_day")
    val closeDay: Int? = null,

    @Column(name = "close_time")
    val closeTime: LocalTime? = null,
)
