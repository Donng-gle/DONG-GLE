"""PostgreSQL place와 ai/semantic_vector 연결 계층."""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

from pipeline.db import get_connection
from pipeline.semantic_score_store import (
  count_semantic_analysis_status,
  save_semantic_analysis_results,
  summarize_place_batch_for_semantic,
)
from semantic_vector import analyze_places
from semantic_vector.config import SemanticVectorConfig
from semantic_vector.input_mapper import (
  map_place_to_semantic_input,
  place_image_inputs_from_db_places,
)
from semantic_vector.models import BatchAnalysisResult, PlaceImageInput

logger = logging.getLogger(__name__)


def _fetch_analyzed_place_ids(config: SemanticVectorConfig) -> set[int]:
  with get_connection() as conn:
    with conn.cursor() as cur:
      cur.execute(
        """
        SELECT place_id
        FROM place_semantic_vector
        WHERE model_name = %s
          AND prompt_version = %s
          AND tag_schema_version = %s
        """,
        (
          config.openai_model,
          config.prompt_version,
          config.tag_schema_version,
        ),
      )
      return {row[0] for row in cur.fetchall()}


def load_places_for_semantic_backfill(
  *,
  limit: int | None = None,
  place_id: int | str | None = None,
  only_unanalyzed: bool = True,
  config: SemanticVectorConfig | None = None,
) -> list[dict[str, Any]]:
  """Semantic Vector Backfill 대상 place 목록을 조회한다.

  only_unanalyzed=True이면 place_semantic_vector에 현재 model/prompt/schema 버전으로
  분석 완료된 장소는 제외한다.
  """
  resolved_config = config or SemanticVectorConfig()
  parsed_place_id = int(place_id) if place_id is not None else None

  with get_connection() as conn:
    with conn.cursor() as cur:
      cur.execute(
        """
        SELECT
            p.id,
            p.content_id,
            p.name,
            p.category::text AS category,
            p.main_image_url,
            COALESCE(
              ARRAY_AGG(pi.img_url ORDER BY pi.sort_order)
                FILTER (WHERE pi.img_url IS NOT NULL),
              ARRAY[]::text[]
            ) AS extra_image_urls
        FROM place p
        LEFT JOIN place_image pi ON pi.place_id = p.id
        LEFT JOIN place_semantic_vector psv ON psv.place_id = p.id
        WHERE (%s::bigint IS NULL OR p.id = %s)
          AND (
            %s = FALSE
            OR psv.place_id IS NULL
            OR psv.model_name <> %s
            OR psv.prompt_version <> %s
            OR psv.tag_schema_version <> %s
          )
        GROUP BY p.id, p.content_id, p.name, p.category, p.main_image_url
        ORDER BY p.id
        LIMIT %s
        """,
        (
          parsed_place_id,
          parsed_place_id,
          only_unanalyzed,
          resolved_config.openai_model,
          resolved_config.prompt_version,
          resolved_config.tag_schema_version,
          limit,
        ),
      )
      columns = [desc[0] for desc in cur.description]
      rows = [dict(zip(columns, row)) for row in cur.fetchall()]

  return rows


def filter_pending_semantic_places(
  places: Sequence[Mapping[str, Any]],
  *,
  config: SemanticVectorConfig | None = None,
) -> list[dict[str, Any]]:
  """현재 버전으로 아직 분석되지 않은 place만 반환한다."""
  resolved_config = config or SemanticVectorConfig()
  analyzed_ids = _fetch_analyzed_place_ids(resolved_config)
  pending: list[dict[str, Any]] = []

  for place in places:
    if not place.get("main_image_url"):
      continue
    if int(place["id"]) in analyzed_ids:
      continue
    pending.append(dict(place))

  return pending


def build_semantic_inputs(
  places: Sequence[Mapping[str, Any]],
  *,
  config: SemanticVectorConfig | None = None,
) -> list[PlaceImageInput]:
  """분석 가능한 PlaceImageInput 목록을 생성한다."""
  resolved_config = config or SemanticVectorConfig()
  return place_image_inputs_from_db_places(
    places,
    images_per_place=resolved_config.images_per_place,
  )


async def analyze_saved_places(
  places: Sequence[Mapping[str, Any]],
  *,
  config: SemanticVectorConfig | None = None,
  concurrency: int | None = None,
  persist_scores: bool = True,
) -> BatchAnalysisResult:
  """저장된 place 목록을 Semantic Vector로 분석한다."""
  resolved_config = config or SemanticVectorConfig()
  inputs = build_semantic_inputs(places, config=resolved_config)
  if not inputs:
    return BatchAnalysisResult(
      total_count=0,
      success_count=0,
      failed_count=0,
      results=[],
      failures=[],
    )

  result = await analyze_places(
    inputs,
    config=resolved_config,
    concurrency=concurrency,
  )

  if persist_scores and result.results:
    with get_connection() as conn:
      with conn.cursor() as cur:
        saved_count = save_semantic_analysis_results(cur, result.results, inputs)
    logger.info("place_semantic_vector saved: %s건", saved_count)

  return result


def log_semantic_analysis_result(
  result: BatchAnalysisResult,
  inputs: Sequence[PlaceImageInput],
  *,
  config: SemanticVectorConfig | None = None,
) -> None:
  """분석 결과를 구조화된 로그로 출력한다."""
  resolved_config = config or SemanticVectorConfig()
  input_by_place_id = {item.place_id: item for item in inputs}

  for item in result.results:
    source = input_by_place_id.get(item.place_id)
    logger.info(
      "semantic_vector success place_id=%s representative_image_url=%s "
      "analysis_image_count=%s model_name=%s prompt_version=%s tag_schema_version=%s",
      item.place_id,
      source.image_url if source else None,
      len(source.resolved_analysis_image_urls()) if source else None,
      item.model_name,
      item.prompt_version,
      item.tag_schema_version,
    )

  for failure in result.failures:
    source = input_by_place_id.get(failure.place_id)
    logger.error(
      "semantic_vector failure place_id=%s representative_image_url=%s "
      "analysis_image_count=%s error_type=%s error_message=%s "
      "model_name=%s prompt_version=%s tag_schema_version=%s",
      failure.place_id,
      source.image_url if source else None,
      len(source.resolved_analysis_image_urls()) if source else None,
      failure.error_type,
      failure.error_message,
      resolved_config.openai_model,
      resolved_config.prompt_version,
      resolved_config.tag_schema_version,
    )


async def run_semantic_vector_sync(
  places: Sequence[Mapping[str, Any]],
  *,
  config: SemanticVectorConfig | None = None,
  concurrency: int | None = None,
) -> BatchAnalysisResult:
  """저장 완료된 place 중 미분석 장소에 대해 Semantic Vector 분석을 실행한다.

  3장 VLM 분석 → detail 평균 → major 계산 → place_semantic_vector 저장 → Qdrant upsert.
  분석 실패는 예외로 전파하지 않고 BatchAnalysisResult로 반환한다.
  """
  resolved_config = config or SemanticVectorConfig()
  pending_places = filter_pending_semantic_places(places, config=resolved_config)
  inputs = build_semantic_inputs(pending_places, config=resolved_config)

  if not inputs:
    return BatchAnalysisResult(
      total_count=0,
      success_count=0,
      failed_count=0,
      results=[],
      failures=[],
    )

  result = await analyze_saved_places(
    pending_places,
    config=resolved_config,
    concurrency=concurrency,
    persist_scores=True,
  )
  log_semantic_analysis_result(result, inputs, config=resolved_config)
  return result


def summarize_saved_places_for_semantic(
  places: Sequence[Mapping[str, Any]],
  *,
  config: SemanticVectorConfig | None = None,
) -> dict[str, int]:
  """저장된 place 중 Semantic Vector 분석 대상 수를 집계한다."""
  resolved_config = config or SemanticVectorConfig()
  analyzed_ids = _fetch_analyzed_place_ids(resolved_config)
  return summarize_place_batch_for_semantic(
    places,
    analyzed_place_ids=analyzed_ids,
  )


def get_semantic_analysis_status(
  *,
  config: SemanticVectorConfig | None = None,
) -> dict[str, int]:
  """전체 place 기준 semantic 분석 완료/미완료 수를 반환한다."""
  resolved_config = config or SemanticVectorConfig()
  with get_connection() as conn:
    with conn.cursor() as cur:
      return count_semantic_analysis_status(
        cur,
        model_name=resolved_config.openai_model,
        prompt_version=resolved_config.prompt_version,
        tag_schema_version=resolved_config.tag_schema_version,
      )


__all__ = [
  "analyze_saved_places",
  "build_semantic_inputs",
  "filter_pending_semantic_places",
  "get_semantic_analysis_status",
  "load_places_for_semantic_backfill",
  "log_semantic_analysis_result",
  "map_place_to_semantic_input",
  "run_semantic_vector_sync",
  "summarize_saved_places_for_semantic",
]
