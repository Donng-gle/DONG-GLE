"""place_semantic_vector / place_image_semantic_vector 테이블에 raw semantic score를 저장한다."""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from typing import Any

from semantic_vector.analyzer import PlaceAnalysisResult
from semantic_vector.models import PlaceImageInput, SemanticVectorResult
from semantic_vector.score_calculator import calculate_major_scores

UPSERT_PLACE_SEMANTIC_VECTOR_SQL = """
INSERT INTO place_semantic_vector (
    place_id,
    representative_image_url,
    analysis_image_urls,
    analysis_image_count,
    detail_scores,
    major_scores,
    summary,
    model_name,
    prompt_version,
    tag_schema_version,
    qdrant_point_id,
    analyzed_at
) VALUES (
    %(place_id)s,
    %(representative_image_url)s,
    %(analysis_image_urls)s::jsonb,
    %(analysis_image_count)s,
    %(detail_scores)s::jsonb,
    %(major_scores)s::jsonb,
    %(summary)s,
    %(model_name)s,
    %(prompt_version)s,
    %(tag_schema_version)s,
    %(qdrant_point_id)s,
    NOW()
)
ON CONFLICT (place_id) DO UPDATE SET
    representative_image_url = EXCLUDED.representative_image_url,
    analysis_image_urls = EXCLUDED.analysis_image_urls,
    analysis_image_count = EXCLUDED.analysis_image_count,
    detail_scores = EXCLUDED.detail_scores,
    major_scores = EXCLUDED.major_scores,
    summary = EXCLUDED.summary,
    model_name = EXCLUDED.model_name,
    prompt_version = EXCLUDED.prompt_version,
    tag_schema_version = EXCLUDED.tag_schema_version,
    qdrant_point_id = EXCLUDED.qdrant_point_id,
    analyzed_at = NOW();
"""

UPSERT_PLACE_IMAGE_SEMANTIC_VECTOR_SQL = """
INSERT INTO place_image_semantic_vector (
    place_id,
    image_url,
    detail_scores,
    major_scores,
    summary,
    model_name,
    prompt_version,
    tag_schema_version,
    analyzed_at
) VALUES (
    %(place_id)s,
    %(image_url)s,
    %(detail_scores)s::jsonb,
    %(major_scores)s::jsonb,
    %(summary)s,
    %(model_name)s,
    %(prompt_version)s,
    %(tag_schema_version)s,
    NOW()
)
ON CONFLICT (place_id, image_url) DO UPDATE SET
    detail_scores = EXCLUDED.detail_scores,
    major_scores = EXCLUDED.major_scores,
    summary = EXCLUDED.summary,
    model_name = EXCLUDED.model_name,
    prompt_version = EXCLUDED.prompt_version,
    tag_schema_version = EXCLUDED.tag_schema_version,
    analyzed_at = NOW();
"""


def build_semantic_score_row(
  result: SemanticVectorResult,
  input_data: PlaceImageInput,
) -> dict[str, Any]:
  """DB upsert용 row dict를 생성한다."""
  analysis_image_urls = input_data.resolved_analysis_image_urls()
  return {
    "place_id": int(input_data.place_id),
    "representative_image_url": input_data.image_url,
    "analysis_image_urls": json.dumps(analysis_image_urls),
    "analysis_image_count": len(analysis_image_urls),
    "detail_scores": json.dumps(result.detail_scores.model_dump()),
    "major_scores": json.dumps(result.major_scores.model_dump()),
    "summary": result.summary,
    "model_name": result.model_name,
    "prompt_version": result.prompt_version,
    "tag_schema_version": result.tag_schema_version,
    "qdrant_point_id": result.qdrant_point_id,
  }


def build_image_semantic_score_rows(
  place_analysis: PlaceAnalysisResult,
  input_data: PlaceImageInput,
) -> list[dict[str, Any]]:
  """이미지별 DB upsert용 row dict 목록을 생성한다.

  major_scores는 place_semantic_vector처럼 여러 이미지를 평균 낸 값이 아니라,
  이 이미지 1장의 detail_scores만으로 계산한다 (score_calculator.calculate_major_scores).
  """
  image_urls = input_data.resolved_analysis_image_urls()
  responses = place_analysis.per_image_responses
  rows: list[dict[str, Any]] = []

  for image_url, response in zip(image_urls, responses, strict=True):
    rows.append(
      {
        "place_id": int(input_data.place_id),
        "image_url": image_url,
        "detail_scores": json.dumps(response.detail_scores.model_dump()),
        "major_scores": json.dumps(
          calculate_major_scores(response.detail_scores).model_dump()
        ),
        "summary": response.summary,
        "model_name": place_analysis.result.model_name,
        "prompt_version": place_analysis.result.prompt_version,
        "tag_schema_version": place_analysis.result.tag_schema_version,
      }
    )

  return rows


def save_semantic_analysis_results(
  cur,
  results: Sequence[PlaceAnalysisResult],
  inputs: Sequence[PlaceImageInput],
) -> int:
  """분석 성공 결과를 place_semantic_vector(장소 단위 집계) +
  place_image_semantic_vector(이미지 단위 원본)에 저장한다.

  반환값은 place_semantic_vector에 저장된 장소 수(기존 동작과 동일)이다.
  """
  input_by_place_id = {item.place_id: item for item in inputs}
  saved_count = 0

  for place_analysis in results:
    result = place_analysis.result
    input_data = input_by_place_id.get(result.place_id)
    if input_data is None:
      continue

    cur.execute(
      UPSERT_PLACE_SEMANTIC_VECTOR_SQL,
      build_semantic_score_row(result, input_data),
    )
    saved_count += 1

    for image_row in build_image_semantic_score_rows(place_analysis, input_data):
      cur.execute(UPSERT_PLACE_IMAGE_SEMANTIC_VECTOR_SQL, image_row)

  return saved_count


def is_place_semantically_analyzed(
  cur,
  place_id: int,
  *,
  model_name: str,
  prompt_version: str,
  tag_schema_version: str,
) -> bool:
  """동일 model/prompt/schema 버전으로 분석 완료된 장소인지 확인한다."""
  cur.execute(
    """
    SELECT 1
    FROM place_semantic_vector
    WHERE place_id = %s
      AND model_name = %s
      AND prompt_version = %s
      AND tag_schema_version = %s
    LIMIT 1
    """,
    (place_id, model_name, prompt_version, tag_schema_version),
  )
  return cur.fetchone() is not None


def count_semantic_analysis_status(
  cur,
  *,
  model_name: str,
  prompt_version: str,
  tag_schema_version: str,
) -> dict[str, int]:
  """분석 완료/미완료 장소 수를 집계한다."""
  cur.execute(
    """
    SELECT
        COUNT(*) FILTER (
          WHERE p.main_image_url IS NOT NULL
            AND psv.place_id IS NOT NULL
            AND psv.model_name = %s
            AND psv.prompt_version = %s
            AND psv.tag_schema_version = %s
        ) AS analyzed_count,
        COUNT(*) FILTER (
          WHERE p.main_image_url IS NOT NULL
            AND (
              psv.place_id IS NULL
              OR psv.model_name <> %s
              OR psv.prompt_version <> %s
              OR psv.tag_schema_version <> %s
            )
        ) AS pending_count,
        COUNT(*) FILTER (WHERE p.main_image_url IS NULL) AS no_image_count
    FROM place p
    LEFT JOIN place_semantic_vector psv ON psv.place_id = p.id
    """,
    (
      model_name,
      prompt_version,
      tag_schema_version,
      model_name,
      prompt_version,
      tag_schema_version,
    ),
  )
  analyzed_count, pending_count, no_image_count = cur.fetchone()
  return {
    "analyzed_count": analyzed_count,
    "pending_count": pending_count,
    "no_image_count": no_image_count,
  }


def summarize_place_batch_for_semantic(
  places: Sequence[Mapping[str, Any]],
  *,
  analyzed_place_ids: set[int],
) -> dict[str, int]:
  """배치 내 분석 대상/스킵 수를 집계한다."""
  analyzable = [place for place in places if place.get("main_image_url")]
  pending = [
    place
    for place in analyzable
    if int(place["id"]) not in analyzed_place_ids
  ]
  return {
    "saved_count": len(places),
    "semantic_target_count": len(pending),
    "already_analyzed_count": len(analyzable) - len(pending),
    "skipped_no_image_count": len(places) - len(analyzable),
  }
