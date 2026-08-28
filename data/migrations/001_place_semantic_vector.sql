-- 장소별 VLM semantic 분석 raw score 저장 테이블
-- place_emotion_tag count 기반 적재를 대체한다.

CREATE TABLE IF NOT EXISTS place_semantic_vector (
    place_id BIGINT PRIMARY KEY REFERENCES place(id) ON DELETE CASCADE,
    representative_image_url TEXT NOT NULL,
    analysis_image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    analysis_image_count INTEGER NOT NULL,
    detail_scores JSONB NOT NULL,
    major_scores JSONB NOT NULL,
    summary TEXT,
    model_name TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    tag_schema_version TEXT NOT NULL,
    qdrant_point_id TEXT NOT NULL,
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_place_semantic_vector_prompt_version
    ON place_semantic_vector (prompt_version);

CREATE INDEX IF NOT EXISTS idx_place_semantic_vector_analyzed_at
    ON place_semantic_vector (analyzed_at DESC);
