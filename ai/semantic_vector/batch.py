"""여러 장소 Batch 분석."""

from __future__ import annotations

import asyncio
from collections.abc import Sequence

from semantic_vector.analyzer import analyze_place
from semantic_vector.config import SemanticVectorConfig
from semantic_vector.exceptions import SemanticVectorError
from semantic_vector.models import (
  BatchAnalysisFailure,
  BatchAnalysisResult,
  PlaceImageInput,
  SemanticVectorResult,
)
from semantic_vector.qdrant_repository import ensure_collection_exists


async def analyze_places(
  places: Sequence[PlaceImageInput],
  *,
  concurrency: int | None = None,
  config: SemanticVectorConfig | None = None,
) -> BatchAnalysisResult:
  """여러 장소를 병렬로 분석한다."""
  resolved_config = config or SemanticVectorConfig()
  if not places:
    return BatchAnalysisResult(
      total_count=0,
      success_count=0,
      failed_count=0,
      results=[],
      failures=[],
    )

  await ensure_collection_exists(resolved_config)

  limit = concurrency or resolved_config.batch_concurrency
  semaphore = asyncio.Semaphore(limit)
  results: list[SemanticVectorResult | None] = [None] * len(places)
  failures: list[BatchAnalysisFailure] = []

  async def _process(index: int, place: PlaceImageInput) -> None:
    async with semaphore:
      try:
        results[index] = await analyze_place(
          place,
          config=resolved_config,
          skip_collection_check=True,
        )
      except SemanticVectorError as error:
        failures.append(
          BatchAnalysisFailure(
            place_id=place.place_id,
            error_type=type(error).__name__,
            error_message=str(error),
          )
        )
      except Exception as error:
        failures.append(
          BatchAnalysisFailure(
            place_id=place.place_id,
            error_type=type(error).__name__,
            error_message=str(error),
          )
        )

  await asyncio.gather(*(_process(index, place) for index, place in enumerate(places)))

  success_results = [result for result in results if result is not None]
  return BatchAnalysisResult(
    total_count=len(places),
    success_count=len(success_results),
    failed_count=len(failures),
    results=success_results,
    failures=failures,
  )
