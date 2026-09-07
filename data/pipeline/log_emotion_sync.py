"""방문 기록 사진(visit_log_photo)을 GPT Vision으로 분석해 log_emotion_tag에 적재한다.

place_semantic_vector 파이프라인(semantic_vector_sync.py)과 조회→분석→저장 구조는 동일하지만
다음 두 가지가 달라서 batch.py의 analyze_places*()를 그대로 쓰지 않고 analyzer를 직접 호출한다:

  1. Qdrant 색인이 필요 없음 — 추천 검색용이 아니라 장소 조회 시점 감성 태그 집계용
     (PlaceService.resolveTags, LogEmotionTagRepository.countTagsByPlaceId 참고).
     batch.analyze_places()/analyze_places_with_details()는 항상 persist=True로 동작해서
     그대로 쓰면 visit_log 분석 결과가 place_semantic_vectors Qdrant 컬렉션에
     가짜 place_id로 섞여 들어간다 — 반드시 persist=False로 호출해야 한다.
  2. 버전(model/prompt/schema) 추적 컬럼이 log_emotion_tag에 없음 — 재분석 대상 판단은
     "해당 visit_log_id 행이 log_emotion_tag에 하나라도 있는지"만 확인한다.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Mapping, Sequence
from typing import Any

from pipeline.db import get_connection
from pipeline.log_emotion_tag_store import count_log_emotion_status, save_log_emotion_tags
from semantic_vector import analyze_place_with_details
from semantic_vector.config import SemanticVectorConfig
from semantic_vector.exceptions import SemanticVectorError
from semantic_vector.input_mapper import select_analysis_image_urls
from semantic_vector.models import BatchAnalysisFailure, BatchAnalysisResult, PlaceImageInput

logger = logging.getLogger(__name__)


def _fetch_analyzed_visit_log_ids() -> set[int]:
  """log_emotion_tag에 이미 행이 존재하는 visit_log_id 집합을 반환한다."""
  with get_connection() as conn:
    with conn.cursor() as cur:
      cur.execute("SELECT DISTINCT visit_log_id FROM log_emotion_tag")
      return {row[0] for row in cur.fetchall()}


def load_visit_logs_for_emotion_backfill(
  *,
  limit: int | None = None,
  visit_log_id: int | str | None = None,
  only_unanalyzed: bool = True,
) -> list[dict[str, Any]]:
  """감성 분석 대상 visit_log 목록을 조회한다 (사진이 1장 이상 있는 방문기록만).

  only_unanalyzed=True이면 log_emotion_tag에 이미 행이 있는 visit_log는 제외한다.
  """
  parsed_id = int(visit_log_id) if visit_log_id is not None else None

  with get_connection() as conn:
    with conn.cursor() as cur:
      cur.execute(
        """
        SELECT
            vl.id,
            ARRAY_AGG(vlp.photo_url ORDER BY vlp.sort_order) AS photo_urls
        FROM visit_log vl
        JOIN visit_log_photo vlp ON vlp.visit_log_id = vl.id
        LEFT JOIN log_emotion_tag let ON let.visit_log_id = vl.id
        WHERE (%s::bigint IS NULL OR vl.id = %s)
          AND (%s = FALSE OR let.visit_log_id IS NULL)
        GROUP BY vl.id
        ORDER BY vl.id
        LIMIT %s
        """,
        (parsed_id, parsed_id, only_unanalyzed, limit),
      )
      columns = [desc[0] for desc in cur.description]
      rows = [dict(zip(columns, row)) for row in cur.fetchall()]

  return rows


def filter_pending_visit_logs(
  visit_logs: Sequence[Mapping[str, Any]],
  *,
  analyzed_visit_log_ids: set[int] | None = None,
) -> list[dict[str, Any]]:
  """사진이 있고 아직 분석 안 된 visit_log만 남긴다."""
  analyzed = (
    analyzed_visit_log_ids
    if analyzed_visit_log_ids is not None
    else _fetch_analyzed_visit_log_ids()
  )
  pending = []
  for visit_log in visit_logs:
    if not visit_log.get("photo_urls"):
      continue
    if int(visit_log["id"]) in analyzed:
      continue
    pending.append(dict(visit_log))
  return pending


def build_visit_log_emotion_inputs(
  visit_logs: Sequence[Mapping[str, Any]],
  *,
  images_per_log: int,
) -> list[PlaceImageInput]:
  """visit_log 목록을 PlaceImageInput으로 변환한다.

  PlaceImageInput.place_id 필드에 visit_log_id를 담아 재사용한다(범용 문자열 식별자).
  장소명/카테고리는 prompt.py가 편향 방지 목적으로 애초에 사용하지 않으므로 전달하지 않는다.
  """
  inputs = []
  for visit_log in visit_logs:
    photo_urls = list(visit_log.get("photo_urls") or [])
    if not photo_urls:
      continue
    analysis_urls = select_analysis_image_urls(
      photo_urls[0],
      photo_urls[1:],
      images_per_place=images_per_log,
    )
    inputs.append(
      PlaceImageInput(
        place_id=str(visit_log["id"]),
        image_url=photo_urls[0],
        analysis_image_urls=analysis_urls,
      )
    )
  return inputs


async def _analyze_visit_log_inputs(
  inputs: Sequence[PlaceImageInput],
  *,
  config: SemanticVectorConfig,
  concurrency: int | None = None,
) -> BatchAnalysisResult:
  """visit_log 이미지를 병렬 분석한다. Qdrant에는 저장하지 않는다(persist=False)."""
  if not inputs:
    return BatchAnalysisResult(total_count=0, success_count=0, failed_count=0, results=[], failures=[])

  limit = concurrency or config.batch_concurrency
  semaphore = asyncio.Semaphore(limit)
  results: list[Any] = [None] * len(inputs)
  failures: list[BatchAnalysisFailure] = []

  async def _process(index: int, item: PlaceImageInput) -> None:
    async with semaphore:
      try:
        place_analysis = await analyze_place_with_details(
          item,
          config=config,
          skip_collection_check=True,
          persist=False,
        )
        results[index] = place_analysis.result
      except SemanticVectorError as error:
        failures.append(
          BatchAnalysisFailure(
            place_id=item.place_id,
            error_type=type(error).__name__,
            error_message=str(error),
          )
        )
      except Exception as error:
        failures.append(
          BatchAnalysisFailure(
            place_id=item.place_id,
            error_type=type(error).__name__,
            error_message=str(error),
          )
        )

  await asyncio.gather(*(_process(index, item) for index, item in enumerate(inputs)))

  success_results = [result for result in results if result is not None]
  return BatchAnalysisResult(
    total_count=len(inputs),
    success_count=len(success_results),
    failed_count=len(failures),
    results=success_results,
    failures=failures,
  )


async def analyze_visit_logs(
  visit_logs: Sequence[Mapping[str, Any]],
  *,
  config: SemanticVectorConfig | None = None,
  concurrency: int | None = None,
  images_per_log: int = 3,
  persist_scores: bool = True,
) -> BatchAnalysisResult:
  """저장된 visit_log 목록 중 미분석 건을 분석하고 log_emotion_tag에 저장한다."""
  resolved_config = config or SemanticVectorConfig()
  pending = filter_pending_visit_logs(visit_logs)
  inputs = build_visit_log_emotion_inputs(pending, images_per_log=images_per_log)

  if not inputs:
    return BatchAnalysisResult(total_count=0, success_count=0, failed_count=0, results=[], failures=[])

  result = await _analyze_visit_log_inputs(inputs, config=resolved_config, concurrency=concurrency)

  if persist_scores and result.results:
    with get_connection() as conn:
      with conn.cursor() as cur:
        saved_count = save_log_emotion_tags(cur, result.results, inputs)
    logger.info("log_emotion_tag saved: %s건 (visit_log 기준)", saved_count)

  for failure in result.failures:
    logger.error(
      "log_emotion_sync failure visit_log_id=%s error_type=%s error_message=%s",
      failure.place_id,
      failure.error_type,
      failure.error_message,
    )

  return result


async def sync_pending_log_emotion_tags(
  *,
  batch_size: int = 20,
  limit: int | None = None,
  concurrency: int | None = None,
  images_per_log: int = 3,
  config: SemanticVectorConfig | None = None,
) -> BatchAnalysisResult:
  """미분석 방문기록을 DB에서 조회해 배치 단위로 분석/적재한다.

  scripts/auto_sync_log_emotion.py의 워커 진입점이다.
  """
  resolved_config = config or SemanticVectorConfig()
  visit_logs = load_visit_logs_for_emotion_backfill(limit=limit, only_unanalyzed=True)
  if not visit_logs:
    return BatchAnalysisResult(total_count=0, success_count=0, failed_count=0, results=[], failures=[])

  merged = BatchAnalysisResult(total_count=0, success_count=0, failed_count=0, results=[], failures=[])
  for start in range(0, len(visit_logs), batch_size):
    batch = visit_logs[start : start + batch_size]
    result = await analyze_visit_logs(
      batch,
      config=resolved_config,
      concurrency=concurrency,
      images_per_log=images_per_log,
    )
    merged = BatchAnalysisResult(
      total_count=merged.total_count + result.total_count,
      success_count=merged.success_count + result.success_count,
      failed_count=merged.failed_count + result.failed_count,
      results=[*merged.results, *result.results],
      failures=[*merged.failures, *result.failures],
    )
  return merged


def get_log_emotion_status() -> dict[str, int]:
  """전체 visit_log 기준 감성 분석 완료/미완료/사진없음 수를 반환한다."""
  with get_connection() as conn:
    with conn.cursor() as cur:
      return count_log_emotion_status(cur)


__all__ = [
  "analyze_visit_logs",
  "build_visit_log_emotion_inputs",
  "filter_pending_visit_logs",
  "get_log_emotion_status",
  "load_visit_logs_for_emotion_backfill",
  "sync_pending_log_emotion_tags",
]
