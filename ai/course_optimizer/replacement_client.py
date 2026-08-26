"""영업 중단 장소 대체 검색."""

from __future__ import annotations

from course_optimizer.config import CourseOptimizerConfig
from course_optimizer.exceptions import ReplacementNotFoundError
from course_optimizer.models import CandidatePlace
from semantic_vector.config import SemanticVectorConfig
from semantic_vector.models import MajorScores
from semantic_vector.qdrant_repository import (
  get_detail_vector_by_place_id,
  search_similar_places_by_detail_vector,
)


def _to_semantic_config(config: CourseOptimizerConfig) -> SemanticVectorConfig:
  return SemanticVectorConfig(
    openai_api_key=config.openai_api_key,
    qdrant_url=config.qdrant_url,
    qdrant_api_key=config.qdrant_api_key,
    qdrant_collection_name=config.qdrant_collection_name,
    max_retry_count=config.max_retry_count,
  )


async def find_replacement_place(
  original: CandidatePlace,
  exclude_place_ids: set[str],
  *,
  config: CourseOptimizerConfig,
) -> CandidatePlace | None:
  """
  동일 category 내 Detail Vector Cosine Similarity 기준 대체 장소를 조회한다.

  Qdrant 접근은 semantic_vector.qdrant_repository 함수를 재사용한다.
  """
  semantic_config = _to_semantic_config(config)
  detail_vector = await get_detail_vector_by_place_id(
    original.place_id,
    config=semantic_config,
  )
  if detail_vector is None:
    return None

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

    return CandidatePlace(
      place_id=hit.place_id,
      category=original.category,
      major_scores=major_scores,
      latitude=float(lat),
      longitude=float(lng),
      name=payload.get("name"),
      is_open=True,
    )

  raise ReplacementNotFoundError(
    f"replacement not found for place_id={original.place_id}"
  )
