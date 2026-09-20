"""qdrant_repository 테스트."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from qdrant_client.http.models import Distance, VectorParams

from semantic_vector.config import SemanticVectorConfig
from semantic_vector.exceptions import QdrantIndexError
from semantic_vector.models import PlaceImageInput, SemanticVectorResult
from semantic_vector.qdrant_repository import (
  SimilarPlaceHit,
  dedupe_hits_by_place_id,
  delete_semantic_vector,
  ensure_collection_exists,
  get_detail_vector_by_place_id,
  search_similar_places_by_detail_vector,
  search_similar_places_by_major_vector,
  upsert_semantic_vector,
)
from semantic_vector.score_calculator import calculate_major_scores
from semantic_vector.tests.conftest import make_detail_scores
from semantic_vector.vector_builder import build_detail_vector, build_major_vector


@pytest.fixture
def config() -> SemanticVectorConfig:
  return SemanticVectorConfig(
    openai_api_key="test-openai",
    qdrant_url="http://localhost:6333",
    qdrant_collection_name="place_semantic_vectors",
  )


@pytest.fixture
def semantic_result() -> SemanticVectorResult:
  detail_scores = make_detail_scores()
  major_scores = calculate_major_scores(detail_scores)
  return SemanticVectorResult(
    place_id="place-1",
    image_id="image-1",
    detail_scores=detail_scores,
    major_scores=major_scores,
    detail_vector=build_detail_vector(detail_scores),
    major_vector=build_major_vector(major_scores),
    summary="test",
    model_name="gpt-4.1-mini",
    prompt_version="semantic-image-v4.1",
    tag_schema_version="tourism-semantic-tags-v1",
    qdrant_point_id="place-1",
  )


@pytest.fixture
def place_input() -> PlaceImageInput:
  return PlaceImageInput(
    place_id="place-1",
    image_id="image-1",
    image_url="https://example.com/image.jpg",
    name="안동 하회마을",
    region="안동",
    category="관광지",
  )


def _valid_collection_info() -> SimpleNamespace:
  return SimpleNamespace(
    config=SimpleNamespace(
      params=SimpleNamespace(
        vectors={
          "major": VectorParams(size=7, distance=Distance.COSINE),
          "detail": VectorParams(size=35, distance=Distance.COSINE),
        }
      )
    )
  )


@pytest.mark.asyncio
async def test_ensure_collection_creates_when_missing(config: SemanticVectorConfig) -> None:
  client = AsyncMock()
  client.collection_exists.return_value = False

  with patch("semantic_vector.qdrant_repository._build_client", return_value=client):
    await ensure_collection_exists(config)

  client.create_collection.assert_awaited_once()
  vectors_config = client.create_collection.await_args.kwargs["vectors_config"]
  assert vectors_config["major"].size == 7
  assert vectors_config["detail"].size == 35
  assert vectors_config["major"].distance == Distance.COSINE


@pytest.mark.asyncio
async def test_ensure_collection_does_not_recreate_when_exists(config: SemanticVectorConfig) -> None:
  client = AsyncMock()
  client.collection_exists.return_value = True
  client.get_collection.return_value = _valid_collection_info()

  with patch("semantic_vector.qdrant_repository._build_client", return_value=client):
    await ensure_collection_exists(config)

  client.create_collection.assert_not_awaited()


@pytest.mark.asyncio
async def test_ensure_collection_rejects_invalid_config(config: SemanticVectorConfig) -> None:
  client = AsyncMock()
  client.collection_exists.return_value = True
  invalid_info = _valid_collection_info()
  invalid_info.config.params.vectors["major"] = VectorParams(size=8, distance=Distance.COSINE)
  client.get_collection.return_value = invalid_info

  with patch("semantic_vector.qdrant_repository._build_client", return_value=client):
    with pytest.raises(QdrantIndexError):
      await ensure_collection_exists(config)


@pytest.mark.asyncio
async def test_upsert_semantic_vector(
  config: SemanticVectorConfig,
  semantic_result: SemanticVectorResult,
  place_input: PlaceImageInput,
) -> None:
  client = AsyncMock()

  with patch("semantic_vector.qdrant_repository._build_client", return_value=client):
    await upsert_semantic_vector(semantic_result, place_input, config=config)

  client.upsert.assert_awaited_once()
  point = client.upsert.await_args.kwargs["points"][0]
  assert point.vector["major"] == semantic_result.major_vector
  assert point.vector["detail"] == semantic_result.detail_vector
  assert point.payload["place_id"] == "place-1"
  assert point.payload["image_id"] == "image-1"
  assert point.payload["image_url"] == "https://example.com/image.jpg"
  assert point.payload["analysis_image_count"] == 1
  assert point.payload["analysis_image_urls"] == ["https://example.com/image.jpg"]
  assert point.payload["prompt_version"] == "semantic-image-v4.1"
  assert point.payload["major_scores"]["relaxing"] == pytest.approx(
    semantic_result.major_scores.relaxing
  )
  assert point.payload["detail_scores"]["quiet"] == pytest.approx(
    semantic_result.detail_scores.quiet
  )


@pytest.mark.asyncio
async def test_delete_semantic_vector(config: SemanticVectorConfig) -> None:
  client = AsyncMock()

  with patch("semantic_vector.qdrant_repository._build_client", return_value=client):
    await delete_semantic_vector("place-1", config=config)

  client.delete.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_detail_vector_by_place_id(config: SemanticVectorConfig) -> None:
  client = AsyncMock()
  client.scroll.return_value = (
    [SimpleNamespace(vector={"detail": [0.1] * 35})],
    None,
  )

  with patch("semantic_vector.qdrant_repository._build_client", return_value=client):
    vector = await get_detail_vector_by_place_id("place-1", config=config)

  assert vector == [0.1] * 35
  client.scroll.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_detail_vector_by_place_id_returns_none_when_missing(
  config: SemanticVectorConfig,
) -> None:
  client = AsyncMock()
  client.scroll.return_value = ([], None)

  with patch("semantic_vector.qdrant_repository._build_client", return_value=client):
    vector = await get_detail_vector_by_place_id("missing", config=config)

  assert vector is None


@pytest.mark.asyncio
async def test_search_similar_places_by_detail_vector(config: SemanticVectorConfig) -> None:
  client = AsyncMock()
  client.query_points.return_value = SimpleNamespace(
    points=[
      SimpleNamespace(
        score=0.95,
        payload={
          "place_id": "place-2",
          "image_id": "place-2-img1",
          "image_url": "https://example.com/2.jpg",
          "category": "관광지",
          "name": "대체 장소",
        },
      ),
      SimpleNamespace(
        score=0.90,
        payload={"place_id": "place-1", "image_id": "place-1-img1", "category": "관광지"},
      ),
    ]
  )

  with patch("semantic_vector.qdrant_repository._build_client", return_value=client):
    hits = await search_similar_places_by_detail_vector(
      [0.1] * 35,
      config=config,
      category="관광지",
      exclude_place_ids={"place-1"},
      limit=5,
    )

  assert len(hits) == 1
  assert hits[0].place_id == "place-2"
  assert hits[0].image_id == "place-2-img1"
  assert hits[0].image_url == "https://example.com/2.jpg"
  assert hits[0].score == 0.95
  client.query_points.assert_awaited_once()
  assert client.query_points.await_args.kwargs["using"] == "detail"
  # over-fetch for image-level duplicates / excludes
  assert client.query_points.await_args.kwargs["limit"] >= 5


@pytest.mark.asyncio
async def test_search_similar_places_by_major_vector(config: SemanticVectorConfig) -> None:
  client = AsyncMock()
  client.query_points.return_value = SimpleNamespace(
    points=[
      SimpleNamespace(
        score=0.88,
        payload={"place_id": "44", "category": "관광지"},
      ),
    ]
  )

  with patch("semantic_vector.qdrant_repository._build_client", return_value=client):
    hits = await search_similar_places_by_major_vector(
      [0.8, 0.2, 0.6, 0.9, 0.7, 0.8, 0.2],
      config=config,
      limit=10,
    )

  assert hits[0].place_id == "44"
  assert hits[0].score == 0.88
  assert client.query_points.await_args.kwargs["using"] == "major"


def test_dedupe_hits_by_place_id_keeps_best_first() -> None:
  hits = [
    SimilarPlaceHit(
      place_id="1",
      score=0.9,
      payload={},
      image_id="1-img1",
      image_url="https://a.jpg",
    ),
    SimilarPlaceHit(
      place_id="1",
      score=0.8,
      payload={},
      image_id="1-img2",
      image_url="https://b.jpg",
    ),
    SimilarPlaceHit(
      place_id="2",
      score=0.7,
      payload={},
      image_id="2-img1",
      image_url="https://c.jpg",
    ),
  ]
  unique = dedupe_hits_by_place_id(hits)
  assert [hit.image_id for hit in unique] == ["1-img1", "2-img1"]
