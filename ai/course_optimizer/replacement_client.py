"""영업 중단 장소 대체 검색."""

from __future__ import annotations

import logging
from datetime import datetime

from course_optimizer.config import CourseOptimizerConfig
from course_optimizer.exceptions import ReplacementNotFoundError
from course_optimizer.models import CandidatePlace, RawOperatingHours, ResolvedOperatingHours
from course_optimizer.operating_hours import is_open_at
from course_optimizer.places_client import fetch_operating_hours
from semantic_vector.config import SemanticVectorConfig
from semantic_vector.models import MajorScores
from semantic_vector.qdrant_repository import (
  get_detail_vector_by_place_id,
  search_similar_places_by_detail_vector,
)

logger = logging.getLogger(__name__)


def _to_semantic_config(config: CourseOptimizerConfig) -> SemanticVectorConfig:
  return SemanticVectorConfig(
    openai_api_key=config.openai_api_key,
    qdrant_url=config.qdrant_url,
    qdrant_api_key=config.qdrant_api_key,
    qdrant_collection_name=config.qdrant_collection_name,
    max_retry_count=config.max_retry_count,
  )


def _hours_from_raw(raw_hours: RawOperatingHours) -> ResolvedOperatingHours | None:
  """대체 검증용: fallback 없이 실제 조회된 운영시간만 사용한다."""
  if raw_hours.is_closed:
    return None
  if raw_hours.is_always_open:
    return ResolvedOperatingHours(is_always_open=True)
  if raw_hours.open_time and raw_hours.close_time:
    return ResolvedOperatingHours(
      open_time=raw_hours.open_time,
      close_time=raw_hours.close_time,
      is_always_open=False,
    )
  return None


async def find_replacement_place(
  original: CandidatePlace,
  exclude_place_ids: set[str],
  *,
  visit_time: datetime,
  config: CourseOptimizerConfig,
) -> CandidatePlace:
  """
  동일 category 내 Detail Vector Cosine Similarity 기준 대체 장소를 조회한다.

  각 후보에 대해 운영시간을 조회하고, visit_time에 영업 중인 장소만 채택한다.
  운영시간이 없거나 방문 시각에 닫혀 있으면 다음 후보를 탐색한다.
  적합한 대체 장소가 없으면 ReplacementNotFoundError를 던진다.
  """
  semantic_config = _to_semantic_config(config)
  detail_vector = await get_detail_vector_by_place_id(
    original.place_id,
    config=semantic_config,
  )
  if detail_vector is None:
    raise ReplacementNotFoundError(
      f"replacement not found for place_id={original.place_id}: detail vector missing"
    )

  excluded = set(exclude_place_ids)
  excluded.add(original.place_id)

  hits = await search_similar_places_by_detail_vector(
    detail_vector,
    config=semantic_config,
    category=original.category,
    exclude_place_ids=excluded,
    limit=20,
  )

  for hit in hits:
    payload = hit.payload
    major_payload = payload.get("major_scores")
    if isinstance(major_payload, dict):
      major_scores = MajorScores(**major_payload)
    else:
      major_scores = original.major_scores

    lat = payload.get("latitude")
    lng = payload.get("longitude")
    if lat is None or lng is None:
      continue

    candidate = CandidatePlace(
      place_id=hit.place_id,
      category=original.category,
      major_scores=major_scores,
      latitude=float(lat),
      longitude=float(lng),
      name=payload.get("name"),
      is_open=True,
    )

    raw_hours = await fetch_operating_hours(
      candidate.place_id,
      candidate=candidate,
      visit_time=visit_time,
      config=config,
    )
    if raw_hours is None:
      logger.info(
        "replacement skipped place_id=%s: operating hours missing",
        candidate.place_id,
      )
      continue

    resolved_hours = _hours_from_raw(raw_hours)
    if resolved_hours is None:
      logger.info(
        "replacement skipped place_id=%s: closed or incomplete hours",
        candidate.place_id,
      )
      continue

    if not is_open_at(visit_time, resolved_hours):
      logger.info(
        "replacement skipped place_id=%s: closed at visit_time=%s",
        candidate.place_id,
        visit_time.isoformat(),
      )
      continue

    return candidate

  raise ReplacementNotFoundError(
    f"replacement not found for place_id={original.place_id}: "
    "no candidate open at visit_time with operating hours"
  )
