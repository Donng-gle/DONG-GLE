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

// 방문 기록 사진 여러 장 (2026-09-06 결정, decision-log 참고). 이전엔 visit_log.photo_url
// 단일 컬럼이었는데(사진 1장만 가능), place_image와 동일한 패턴(부모 테이블 + sort_order)으로
// 확장해서 여러 장을 순서대로 저장함.
@Entity
@Table(name = "visit_log_photo")
class VisitLogPhoto(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "visit_log_id", nullable = false)
    val visitLog: VisitLog,

    @Column(name = "photo_url", nullable = false)
    val photoUrl: String,

    @Column(name = "sort_order", nullable = false)
    val sortOrder: Int = 0,

    // 사진별 캡션 (2026-09-07 결정, decision-log 참고). "취향 맞춤 코스" 탭에서 다른 사용자의
    // 기록을 사진 캐러셀로 넘기면 그 사진에 달린 글로 바뀌게 하기 위해 추가 — 기존 one_line은
    // 로그 전체 기준 1개뿐이라 사진별로 다른 글을 담을 수 없었음. 실제 데이터 0건이라 무손실
    // 컬럼 추가(이전 사진 여러 장 지원 때와 동일한 패턴)
    @Column(name = "caption")
    val caption: String? = null,
)
