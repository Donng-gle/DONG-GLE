"""Qdrant Collection 및 Point 저장 (이미지 단위 point)."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from qdrant_client import AsyncQdrantClient
from qdrant_client.http.exceptions import ResponseHandlingException, UnexpectedResponse
from qdrant_client.http.models import Distance, FieldCondition, Filter, MatchValue, PointStruct, VectorParams

from semantic_vector.config import SemanticVectorConfig
from semantic_vector.exceptions import QdrantIndexError
from semantic_vector.models import PlaceImageInput, SemanticVectorResult
from semantic_vector.retry import retry_async

_EXPECTED_VECTORS = {
  "major": (7, Distance.COSINE),
  "detail": (35, Distance.COSINE),
}


@dataclass(frozen=True)
class SimilarPlaceHit:
  """이미지 단위 Cosine Similarity 검색 결과."""

  place_id: str
  score: float
  payload: dict[str, Any]
  image_id: str | None = None
  image_url: str | None = None


def dedupe_hits_by_place_id(hits: Sequence[SimilarPlaceHit]) -> list[SimilarPlaceHit]:
  """같은 place_id는 점수 순에서 처음(최고) hit만 남긴다."""
  seen: set[str] = set()
  unique: list[SimilarPlaceHit] = []
  for hit in hits:
    if hit.place_id in seen:
      continue
    seen.add(hit.place_id)
    unique.append(hit)
  return unique


def _build_client(config: SemanticVectorConfig) -> AsyncQdrantClient:
  return AsyncQdrantClient(
    url=config.qdrant_url,
    api_key=config.qdrant_api_key,
  )


def _validate_existing_collection(collection_info) -> None:
  """기존 Collection의 named vector 설정을 검증한다."""
  vectors = collection_info.config.params.vectors
  if not isinstance(vectors, dict):
    raise QdrantIndexError("collection must use named vectors")

  for name, (expected_size, expected_distance) in _EXPECTED_VECTORS.items():
    if name not in vectors:
      raise QdrantIndexError(f"missing named vector: {name}")

    params = vectors[name]
    if params.size != expected_size:
      raise QdrantIndexError(
        f"{name}.size must be {expected_size}, got {params.size}"
      )
    if params.distance != expected_distance:
      raise QdrantIndexError(
        f"{name}.distance must be {expected_distance}, got {params.distance}"
      )


async def ensure_collection_exists(config: SemanticVectorConfig) -> None:
  """Collection이 없으면 생성하고, 있으면 설정을 검증한다."""
  client = _build_client(config)

  async def _ensure_once() -> None:
    try:
      exists = await client.collection_exists(config.qdrant_collection_name)
      if not exists:
        await client.create_collection(
          collection_name=config.qdrant_collection_name,
          vectors_config={
            "major": VectorParams(size=7, distance=Distance.COSINE),
            "detail": VectorParams(size=35, distance=Distance.COSINE),
          },
        )
        return

      collection_info = await client.get_collection(config.qdrant_collection_name)
      _validate_existing_collection(collection_info)
    except (ResponseHandlingException, UnexpectedResponse) as error:
      raise QdrantIndexError(str(error)) from error

  await retry_async(
    _ensure_once,
    max_retry_count=config.max_retry_count,
    retryable_exceptions=(OSError,),
  )


async def upsert_semantic_vector(
  result: SemanticVectorResult,
  input_data: PlaceImageInput,
  *,
  config: SemanticVectorConfig,
) -> None:
  """이미지 단위 Semantic vector Point를 Qdrant에 upsert한다."""
  if not input_data.image_id:
    raise QdrantIndexError("image_id is required for Qdrant image-level upsert")
  if not input_data.image_url:
    raise QdrantIndexError("image_url is required for Qdrant image-level upsert")

  client = _build_client(config)
  payload = {
    "place_id": input_data.place_id,
    "image_id": input_data.image_id,
    "image_url": input_data.image_url,
    "analysis_image_count": 1,
    "analysis_image_urls": [input_data.image_url],
    "name": input_data.name,
    "region": input_data.region,
    "category": input_data.category,
    "major_scores": result.major_scores.model_dump(),
    "detail_scores": result.detail_scores.model_dump(),
    "summary": result.summary,
    "model_name": result.model_name,
    "prompt_version": result.prompt_version,
    "tag_schema_version": result.tag_schema_version,
  }

  async def _upsert() -> None:
    try:
      await client.upsert(
        collection_name=config.qdrant_collection_name,
        points=[
          PointStruct(
            id=result.qdrant_point_id,
            vector={
              "major": result.major_vector,
              "detail": result.detail_vector,
            },
            payload=payload,
          )
        ],
      )
    except (ResponseHandlingException, UnexpectedResponse) as error:
      raise QdrantIndexError(str(error)) from error
    except OSError as error:
      raise QdrantIndexError(str(error)) from error

  await retry_async(
    _upsert,
    max_retry_count=config.max_retry_count,
    retryable_exceptions=(OSError,),
  )


async def delete_semantic_vector(
  point_id: str,
  *,
  config: SemanticVectorConfig,
) -> None:
  """Qdrant Point를 삭제한다."""
  client = _build_client(config)

  async def _delete() -> None:
    try:
      await client.delete(
        collection_name=config.qdrant_collection_name,
        points_selector=[point_id],
      )
    except (ResponseHandlingException, UnexpectedResponse) as error:
      raise QdrantIndexError(str(error)) from error
    except OSError as error:
      raise QdrantIndexError(str(error)) from error

  await retry_async(
    _delete,
    max_retry_count=config.max_retry_count,
    retryable_exceptions=(OSError,),
  )


async def get_detail_vector_by_place_id(
  place_id: str,
  *,
  config: SemanticVectorConfig,
) -> list[float] | None:
  """place_id에 해당하는 이미지 point 중 하나의 Detail Vector를 조회한다.

  이미지 단위 색인이므로 동일 place_id에 여러 point가 있을 수 있다.
  scroll limit=1로 임의(첫) 이미지 벡터를 반환한다.
  """
  client = _build_client(config)

  async def _scroll() -> list[float] | None:
    try:
      points, _ = await client.scroll(
        collection_name=config.qdrant_collection_name,
        scroll_filter=Filter(
          must=[FieldCondition(key="place_id", match=MatchValue(value=place_id))]
        ),
        limit=1,
        with_vectors=["detail"],
      )
    except (ResponseHandlingException, UnexpectedResponse) as error:
      raise QdrantIndexError(str(error)) from error

    if not points:
      return None

    vector = points[0].vector
    if isinstance(vector, dict):
      detail = vector.get("detail")
      return list(detail) if detail is not None else None
    return None

  return await retry_async(
    _scroll,
    max_retry_count=config.max_retry_count,
    retryable_exceptions=(OSError,),
  )


def _hit_from_point(point: Any) -> SimilarPlaceHit | None:
  payload = point.payload or {}
  hit_place_id = str(payload.get("place_id", ""))
  if not hit_place_id:
    return None
  image_id = payload.get("image_id")
  image_url = payload.get("image_url")
  return SimilarPlaceHit(
    place_id=hit_place_id,
    score=float(point.score or 0.0),
    payload=payload,
    image_id=str(image_id) if image_id is not None else None,
    image_url=str(image_url) if image_url is not None else None,
  )


async def search_similar_places_by_named_vector(
  query_vector: list[float],
  *,
  config: SemanticVectorConfig,
  named_vector: str,
  category: str | None = None,
  exclude_place_ids: set[str] | None = None,
  limit: int = 20,
) -> list[SimilarPlaceHit]:
  """Named Vector Cosine Similarity 기준으로 유사 이미지 point를 검색한다.

  이미지 단위이므로 같은 place_id가 여러 번 나올 수 있다.
  exclude 필터 후에도 충분히 남도록 Qdrant limit을 over-fetch한다.
  """
  if named_vector not in _EXPECTED_VECTORS:
    raise QdrantIndexError(f"unknown named vector: {named_vector}")

  client = _build_client(config)
  excluded = exclude_place_ids or set()
  # 이미지 중복 + exclude 소모를 고려해 over-fetch
  qdrant_limit = max(limit * 3, limit + len(excluded) * 2, 20)

  async def _search() -> list[SimilarPlaceHit]:
    try:
      query_filter = None
      if category is not None:
        query_filter = Filter(
          must=[FieldCondition(key="category", match=MatchValue(value=category))]
        )

      results = await client.query_points(
        collection_name=config.qdrant_collection_name,
        query=query_vector,
        using=named_vector,
        query_filter=query_filter,
        limit=qdrant_limit,
        with_payload=True,
      )
    except (ResponseHandlingException, UnexpectedResponse) as error:
      raise QdrantIndexError(str(error)) from error

    hits: list[SimilarPlaceHit] = []
    for point in results.points:
      hit = _hit_from_point(point)
      if hit is None or hit.place_id in excluded:
        continue
      hits.append(hit)
      if len(hits) >= limit * 3:
        break
    return hits

  return await retry_async(
    _search,
    max_retry_count=config.max_retry_count,
    retryable_exceptions=(OSError,),
  )


async def search_similar_places_by_detail_vector(
  detail_vector: list[float],
  *,
  config: SemanticVectorConfig,
  category: str | None = None,
  exclude_place_ids: set[str] | None = None,
  limit: int = 20,
) -> list[SimilarPlaceHit]:
  """Detail Vector Cosine Similarity 기준으로 유사 이미지 point를 검색한다."""
  return await search_similar_places_by_named_vector(
    detail_vector,
    config=config,
    named_vector="detail",
    category=category,
    exclude_place_ids=exclude_place_ids,
    limit=limit,
  )


async def search_similar_places_by_major_vector(
  major_vector: list[float],
  *,
  config: SemanticVectorConfig,
  category: str | None = None,
  exclude_place_ids: set[str] | None = None,
  limit: int = 20,
) -> list[SimilarPlaceHit]:
  """Major Vector Cosine Similarity 기준으로 유사 이미지 point를 검색한다."""
  return await search_similar_places_by_named_vector(
    major_vector,
    config=config,
    named_vector="major",
    category=category,
    exclude_place_ids=exclude_place_ids,
    limit=limit,
  )
