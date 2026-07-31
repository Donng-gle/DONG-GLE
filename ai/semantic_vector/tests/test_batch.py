"""batch 테스트."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from semantic_vector.batch import analyze_places
from semantic_vector.config import SemanticVectorConfig
from semantic_vector.exceptions import InvalidVisionResponseError
from semantic_vector.models import PlaceImageInput, SemanticVectorResult
from semantic_vector.score_calculator import calculate_major_scores
from semantic_vector.tests.conftest import make_detail_scores
from semantic_vector.vector_builder import build_detail_vector, build_major_vector


@pytest.fixture
def config() -> SemanticVectorConfig:
  return SemanticVectorConfig(
    openai_api_key="test-openai",
    qdrant_url="http://localhost:6333",
    batch_concurrency=2,
  )


def _make_result(place_id: str) -> SemanticVectorResult:
  detail_scores = make_detail_scores()
  major_scores = calculate_major_scores(detail_scores)
  return SemanticVectorResult(
    place_id=place_id,
    image_id=None,
    detail_scores=detail_scores,
    major_scores=major_scores,
    detail_vector=build_detail_vector(detail_scores),
    major_vector=build_major_vector(major_scores),
    summary=None,
    model_name="gpt-4.1-mini",
    prompt_version="semantic-image-v1",
    tag_schema_version="tourism-semantic-tags-v1",
    qdrant_point_id=place_id,
  )


def _make_place(place_id: str) -> PlaceImageInput:
  return PlaceImageInput(
    place_id=place_id,
    image_url=f"https://example.com/{place_id}.jpg",
  )


@pytest.mark.asyncio
async def test_analyze_places_empty_input(config: SemanticVectorConfig) -> None:
  result = await analyze_places([], config=config)
  assert result.total_count == 0
  assert result.success_count == 0
  assert result.failed_count == 0


@pytest.mark.asyncio
async def test_analyze_places_all_success(config: SemanticVectorConfig) -> None:
  places = [_make_place("p1"), _make_place("p2")]

  with (
    patch(
      "semantic_vector.batch.ensure_collection_exists",
      new=AsyncMock(),
    ) as ensure_mock,
    patch(
      "semantic_vector.batch.analyze_place",
      new=AsyncMock(side_effect=[_make_result("p1"), _make_result("p2")]),
    ),
  ):
    result = await analyze_places(places, config=config)

  ensure_mock.assert_awaited_once()
  assert result.total_count == 2
  assert result.success_count == 2
  assert result.failed_count == 0


@pytest.mark.asyncio
async def test_analyze_places_partial_failure(config: SemanticVectorConfig) -> None:
  places = [_make_place("p1"), _make_place("p2")]

  async def _analyze(place: PlaceImageInput, **kwargs) -> SemanticVectorResult:
    if place.place_id == "p2":
      raise InvalidVisionResponseError("failed")
    return _make_result(place.place_id)

  with (
    patch("semantic_vector.batch.ensure_collection_exists", new=AsyncMock()),
    patch("semantic_vector.batch.analyze_place", new=AsyncMock(side_effect=_analyze)),
  ):
    result = await analyze_places(places, config=config)

  assert result.success_count == 1
  assert result.failed_count == 1
  assert result.failures[0].place_id == "p2"


@pytest.mark.asyncio
async def test_analyze_places_all_failure(config: SemanticVectorConfig) -> None:
  places = [_make_place("p1")]

  with (
    patch("semantic_vector.batch.ensure_collection_exists", new=AsyncMock()),
    patch(
      "semantic_vector.batch.analyze_place",
      new=AsyncMock(side_effect=InvalidVisionResponseError("failed")),
    ),
  ):
    result = await analyze_places(places, config=config)

  assert result.success_count == 0
  assert result.failed_count == 1


@pytest.mark.asyncio
async def test_analyze_places_respects_semaphore(config: SemanticVectorConfig) -> None:
  places = [_make_place(f"p{i}") for i in range(4)]
  active = 0
  max_active = 0

  async def _analyze(place: PlaceImageInput, **kwargs) -> SemanticVectorResult:
    nonlocal active, max_active
    active += 1
    max_active = max(max_active, active)
    await asyncio.sleep(0.01)
    active -= 1
    return _make_result(place.place_id)

  with (
    patch("semantic_vector.batch.ensure_collection_exists", new=AsyncMock()),
    patch("semantic_vector.batch.analyze_place", new=AsyncMock(side_effect=_analyze)),
  ):
    await analyze_places(places, concurrency=2, config=config)

  assert max_active <= 2
