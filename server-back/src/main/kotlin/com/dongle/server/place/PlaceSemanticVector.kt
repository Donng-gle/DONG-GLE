package com.dongle.server.place

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.OffsetDateTime

// AI 파트(김지광)가 semantic-image-v4.1 프롬프트로 사진 3장 기반 분석한 raw score.
// 데이터 파트 배치 스크립트로만 적재됨(data/pipeline/semantic_vector_sync.py) — 백엔드는 읽기 전용.
// analysis_image_urls/major_scores/detail_scores는 jsonb 컬럼을 원문 그대로 읽어와서 서비스 계층에서 파싱한다
// (DB_URL의 stringtype=unspecified 덕분에 String으로 바로 읽힘, ddl-auto: none이라 스키마 검증도 안 걸림)
@Entity
@Table(name = "place_semantic_vector")
class PlaceSemanticVector(
    @Id
    @Column(name = "place_id")
    val placeId: Long,

    @Column(name = "representative_image_url", nullable = false)
    val representativeImageUrl: String,

    // jsonb 문자열 배열 원문 그대로 보관 (majorScores/detailScores와 동일한 방식)
    @Column(name = "analysis_image_urls", nullable = false)
    val analysisImageUrls: String = "[]",

    @Column(name = "analysis_image_count", nullable = false)
    val analysisImageCount: Int,

    @Column(name = "major_scores", nullable = false)
    val majorScores: String,

    @Column(name = "detail_scores", nullable = false)
    val detailScores: String,

    val summary: String? = null,

    @Column(name = "model_name", nullable = false)
    val modelName: String,

    @Column(name = "prompt_version", nullable = false)
    val promptVersion: String,

    @Column(name = "tag_schema_version", nullable = false)
    val tagSchemaVersion: String,

    @Column(name = "qdrant_point_id", nullable = false)
    val qdrantPointId: String,

    @Column(name = "analyzed_at", nullable = false)
    val analyzedAt: OffsetDateTime,
)
