package com.dongle.server.visitlog

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table

@Entity
@Table(name = "log_emotion_tag")
class LogEmotionTag(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "visit_log_id", nullable = false)
    val visitLog: VisitLog,

    @Column(nullable = false)
    val tag: String,

    // AI가 이 방문 기록 사진에서 이 태그를 얼마나 확신했는지(0.0~1.0). 실제 Supabase
    // log_emotion_tag 테이블엔 이미 NOT NULL로 있었는데 스키마 문서/엔티티에 반영이 안 돼서
    // 뒤늦게 맞춤 (2026-09-03 발견, decision-log 참고). LogEmotionTagRepository.countTagsByPlaceId가
    // 장소 상위 태그 정렬에 사용함(단순 등장 횟수 대신 확신도 합산으로 가중치를 둠)
    @Column(nullable = false)
    val score: Double,
)
