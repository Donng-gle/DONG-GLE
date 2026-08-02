"""PostgreSQL place와 ai/semantic_vector 연결 계층."""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

from pipeline.db import get_connection
from semantic_vector import analyze_places
from semantic_vector.config import SemanticVectorConfig
from semantic_vector.input_mapper import (
  map_place_to_semantic_input,
  place_image_inputs_from_db_places,
)
from semantic_vector.models import BatchAnalysisResult, PlaceImageInput

logger = logging.getLogger(__name__)


def load_places_for_semantic_backfill(
  *,
  limit: int | None = None,
  place_id: int | str | None = None,
) -> list[dict[str, Any]]:
  """Semantic Vector Backfill 대상 place 목록을 조회한다."""
  parsed_place_id = int(place_id) if place_id is not None else None

  with get_connection() as conn:
    with conn.cursor() as cur:
      cur.execute(
        """
        SELECT
            id,
            content_id,
            name,
            category::text AS category,
            main_image_url
        FROM place
        WHERE (%s::bigint IS NULL OR id = %s)
        ORDER BY id
        LIMIT %s
        """,
        (parsed_place_id, parsed_place_id, limit),
      )
      columns = [desc[0] for desc in cur.description]
      rows = [dict(zip(columns, row)) for row in cur.fetchall()]

  return rows


def build_semantic_inputs(
  places: Sequence[Mapping[str, Any]],
) -> list[PlaceImageInput]:
  """분석 가능한 PlaceImageInput 목록을 생성한다."""
  return place_image_inputs_from_db_places(places)


async def analyze_saved_places(
  places: Sequence[Mapping[str, Any]],
  *,
  config: SemanticVectorConfig | None = None,
  concurrency: int | None = None,
) -> BatchAnalysisResult:
  """저장된 place 목록을 Semantic Vector로 분석한다."""
  inputs = build_semantic_inputs(places)
  if not inputs:
    return BatchAnalysisResult(
      total_count=0,
      success_count=0,
      failed_count=0,
      results=[],
      failures=[],
    )

  return await analyze_places(inputs, config=config, concurrency=concurrency)


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
      "semantic_vector success place_id=%s image_url=%s model_name=%s prompt_version=%s",
      item.place_id,
      source.image_url if source else None,
      item.model_name,
      item.prompt_version,
    )

  for failure in result.failures:
    source = input_by_place_id.get(failure.place_id)
    logger.error(
      "semantic_vector failure place_id=%s image_url=%s error_type=%s error_message=%s "
      "model_name=%s prompt_version=%s",
      failure.place_id,
      source.image_url if source else None,
      failure.error_type,
      failure.error_message,
      resolved_config.openai_model,
      resolved_config.prompt_version,
    )


async def run_semantic_vector_sync(
  places: Sequence[Mapping[str, Any]],
  *,
  config: SemanticVectorConfig | None = None,
  concurrency: int | None = None,
) -> BatchAnalysisResult:
  """저장 완료된 place에 대해 Semantic Vector 분석을 실행한다.

  분석 실패는 예외로 전파하지 않고 BatchAnalysisResult로 반환한다.
  """
  inputs = build_semantic_inputs(places)
  result = await analyze_saved_places(
    places,
    config=config,
    concurrency=concurrency,
  )
  log_semantic_analysis_result(result, inputs, config=config)
  return result


def summarize_saved_places_for_semantic(
  places: Sequence[Mapping[str, Any]],
) -> dict[str, int]:
  """저장된 place 중 Semantic Vector 분석 대상 수를 집계한다."""
  analyzable = build_semantic_inputs(places)
  return {
    "saved_count": len(places),
    "semantic_target_count": len(analyzable),
    "skipped_no_image_count": len(places) - len(analyzable),
  }


__all__ = [
  "analyze_saved_places",
  "build_semantic_inputs",
  "load_places_for_semantic_backfill",
  "log_semantic_analysis_result",
  "map_place_to_semantic_input",
  "run_semantic_vector_sync",
  "summarize_saved_places_for_semantic",
]
