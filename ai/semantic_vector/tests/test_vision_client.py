"""vision_client 프롬프트 분기 테스트."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from semantic_vector.config import SemanticVectorConfig
from semantic_vector.models import PlaceImageInput
from semantic_vector.prompt import FOOD_CATEGORY_ANALYSIS_PROMPT, GENERAL_PLACE_ANALYSIS_PROMPT
from semantic_vector.tests.conftest import make_detail_scores
from semantic_vector.vision_client import analyze_image_with_vision


@pytest.fixture
def config() -> SemanticVectorConfig:
  return SemanticVectorConfig(
    openai_api_key="test-openai",
    qdrant_url="http://localhost:6333",
  )


def _mock_openai_response() -> MagicMock:
  payload = {
    "detail_scores": make_detail_scores().model_dump(),
    "summary": "테스트 요약",
  }
  message = MagicMock()
  message.content = json.dumps(payload)
  choice = MagicMock()
  choice.message = message
  response = MagicMock()
  response.choices = [choice]
  return response


@pytest.mark.asyncio
@pytest.mark.parametrize(
  ("category", "expected_prompt"),
  [
    ("관광지", GENERAL_PLACE_ANALYSIS_PROMPT),
    ("식당", FOOD_CATEGORY_ANALYSIS_PROMPT),
    ("카페", FOOD_CATEGORY_ANALYSIS_PROMPT),
  ],
)
async def test_analyze_image_with_vision_selects_prompt_by_category(
  config: SemanticVectorConfig,
  category: str,
  expected_prompt: str,
) -> None:
  place = PlaceImageInput(
    place_id="1",
    image_url="https://example.com/image.jpg",
    category=category,
  )
  create_mock = AsyncMock(return_value=_mock_openai_response())
  client_mock = MagicMock()
  client_mock.chat.completions.create = create_mock

  with patch("semantic_vector.vision_client.AsyncOpenAI", return_value=client_mock):
    await analyze_image_with_vision(place, config=config)

  messages = create_mock.await_args.kwargs["messages"]
  assert messages[0]["content"] == expected_prompt
