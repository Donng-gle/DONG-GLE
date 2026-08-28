"""analyzer 테스트."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from semantic_vector.analyzer import analyze_place, analyze_place_with_details
from semantic_vector.config import SemanticVectorConfig
from semantic_vector.exceptions import InvalidVisionResponseError
from semantic_vector.models import PlaceImageInput, VisionAnalysisResponse
from semantic_vector.tests.conftest import make_detail_scores


@pytest.fixture
def config() -> SemanticVectorConfig:
  return SemanticVectorConfig(
    openai_api_key="test-openai",
    qdrant_url="http://localhost:6333",
  )


@pytest.fixture
def place_input() -> PlaceImageInput:
  return PlaceImageInput(
    place_id="place-1001",
    image_id="image-9001",
    image_url="https://example.com/place.jpg",
    name="안동 하회마을",
    region="안동",
    category="관광지",
  )


@pytest.fixture
def vision_response() -> VisionAnalysisResponse:
  return VisionAnalysisResponse(detail_scores=make_detail_scores(), summary="조용한 전통 마을")


@pytest.mark.asyncio
async def test_analyze_place_full_flow(
  config: SemanticVectorConfig,
  place_input: PlaceImageInput,
  vision_response: VisionAnalysisResponse,
) -> None:
  with (
    patch(
      "semantic_vector.analyzer.analyze_image_with_vision",
      new=AsyncMock(return_value=vision_response),
    ) as vision_mock,
    patch(
      "semantic_vector.analyzer.ensure_collection_exists",
      new=AsyncMock(),
    ) as ensure_mock,
    patch(
      "semantic_vector.analyzer.upsert_semantic_vector",
      new=AsyncMock(),
    ) as upsert_mock,
  ):
    result = await analyze_place(place_input, config=config)

  vision_mock.assert_awaited_once()
  ensure_mock.assert_awaited_once()
  upsert_mock.assert_awaited_once()
  upsert_input = upsert_mock.await_args.args[1]
  assert upsert_input.image_url == place_input.image_url
  assert result.place_id == "place-1001"
  assert len(result.detail_vector) == 35
  assert len(result.major_vector) == 7
  assert result.summary == "조용한 전통 마을"
  assert result.model_name == config.openai_model
  assert vision_mock.await_args.kwargs["image_index"] == 1


@pytest.mark.asyncio
async def test_analyze_place_aggregates_multiple_images(
  config: SemanticVectorConfig,
  vision_response: VisionAnalysisResponse,
) -> None:
  place_input = PlaceImageInput(
    place_id="place-1001",
    image_url="https://example.com/main.jpg",
    analysis_image_urls=[
      "https://example.com/main.jpg",
      "https://example.com/extra-1.jpg",
      "https://example.com/extra-2.jpg",
    ],
    category="관광지",
  )

  with (
    patch(
      "semantic_vector.analyzer.analyze_image_with_vision",
      new=AsyncMock(return_value=vision_response),
    ) as vision_mock,
    patch("semantic_vector.analyzer.ensure_collection_exists", new=AsyncMock()),
    patch("semantic_vector.analyzer.upsert_semantic_vector", new=AsyncMock()) as upsert_mock,
  ):
    result = await analyze_place(place_input, config=config)

  assert vision_mock.await_count == 3
  assert result.summary.count(" | ") == 2
  upsert_input = upsert_mock.await_args.args[1]
  assert upsert_input.image_url == "https://example.com/main.jpg"


@pytest.mark.asyncio
async def test_analyze_place_does_not_upsert_when_vision_fails(
  config: SemanticVectorConfig,
  place_input: PlaceImageInput,
) -> None:
  with (
    patch(
      "semantic_vector.analyzer.analyze_image_with_vision",
      new=AsyncMock(side_effect=InvalidVisionResponseError("bad json")),
    ),
    patch(
      "semantic_vector.analyzer.ensure_collection_exists",
      new=AsyncMock(),
    ) as ensure_mock,
    patch(
      "semantic_vector.analyzer.upsert_semantic_vector",
      new=AsyncMock(),
    ) as upsert_mock,
  ):
    with pytest.raises(InvalidVisionResponseError):
      await analyze_place(place_input, config=config)

  ensure_mock.assert_not_awaited()
  upsert_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_analyze_place_with_details_can_skip_persist(
  config: SemanticVectorConfig,
  place_input: PlaceImageInput,
  vision_response: VisionAnalysisResponse,
) -> None:
  with (
    patch(
      "semantic_vector.analyzer.analyze_image_with_vision",
      new=AsyncMock(return_value=vision_response),
    ),
    patch("semantic_vector.analyzer.ensure_collection_exists", new=AsyncMock()) as ensure_mock,
    patch("semantic_vector.analyzer.upsert_semantic_vector", new=AsyncMock()) as upsert_mock,
  ):
    place_analysis = await analyze_place_with_details(
      place_input,
      config=config,
      persist=False,
    )

  ensure_mock.assert_not_awaited()
  upsert_mock.assert_not_awaited()
  assert place_analysis.result.place_id == "place-1001"
  assert len(place_analysis.per_image_responses) == 1
