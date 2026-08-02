"""Qdrant Collection 및 Point 저장."""

from __future__ import annotations

from qdrant_client import AsyncQdrantClient
from qdrant_client.http.exceptions import ResponseHandlingException, UnexpectedResponse
from qdrant_client.http.models import Distance, PointStruct, VectorParams

from semantic_vector.config import SemanticVectorConfig
from semantic_vector.exceptions import QdrantIndexError
from semantic_vector.models import PlaceImageInput, SemanticVectorResult
from semantic_vector.retry import retry_async

_EXPECTED_VECTORS = {
  "major": (7, Distance.COSINE),
  "detail": (35, Distance.COSINE),
}


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
  """Semantic vector Point를 Qdrant에 upsert한다."""
  client = _build_client(config)
  payload = {
    "place_id": input_data.place_id,
    "image_id": input_data.image_id,
    "image_url": input_data.image_url,
    "name": input_data.name,
    "region": input_data.region,
    "category": input_data.category,
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
