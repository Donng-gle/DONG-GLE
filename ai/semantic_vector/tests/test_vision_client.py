"""vision_client 프롬프트 테스트."""

from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from semantic_vector.config import SemanticVectorConfig
from semantic_vector.models import PlaceImageInput
from semantic_vector.prompt import PLACE_SPACE_ANALYSIS_PROMPT
from semantic_vector.tests.conftest import make_detail_scores
from semantic_vector.exceptions import InvalidVisionResponseError, VisionRetryableError
from semantic_vector.vision_client import (
  _convert_openai_error,
  _create_openai_client,
  analyze_image_with_vision,
  extract_usage_from_response,
)


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
  response.usage = SimpleNamespace(
    prompt_tokens=1200,
    completion_tokens=400,
    total_tokens=1600,
    prompt_tokens_details=SimpleNamespace(cached_tokens=100),
  )
  return response


@pytest.mark.asyncio
@pytest.mark.parametrize("category", ["관광지", "식당", "카페"])
async def test_analyze_image_with_vision_uses_unified_prompt(
  config: SemanticVectorConfig,
  category: str,
) -> None:
  place = PlaceImageInput(
    place_id="1",
    image_url="https://example.com/image.jpg",
    category=category,
  )
  create_mock = AsyncMock(return_value=_mock_openai_response())
  client_mock = MagicMock()
  client_mock.chat.completions.create = create_mock

  with patch(
    "semantic_vector.vision_client._create_openai_client",
    return_value=client_mock,
  ) as create_client_mock:
    result = await analyze_image_with_vision(place, config=config, image_index=2)

  messages = create_mock.await_args.kwargs["messages"]
  assert messages[0]["content"] == PLACE_SPACE_ANALYSIS_PROMPT
  assert result.usage is not None
  assert result.usage.input_tokens == 1200
  assert result.usage.output_tokens == 400
  assert result.usage.total_tokens == 1600
  assert result.usage.cached_input_tokens == 100
  assert result.usage.success is True
  assert create_client_mock.call_args.kwargs["chat_name"] == "image 2 VLM call"


def test_extract_usage_from_response_reads_openai_usage() -> None:
  response = SimpleNamespace(
    usage=SimpleNamespace(
      prompt_tokens=10,
      completion_tokens=4,
      total_tokens=14,
      prompt_tokens_details=SimpleNamespace(cached_tokens=2),
    )
  )

  usage = extract_usage_from_response(response, latency_ms=123.4)

  assert usage.input_tokens == 10
  assert usage.output_tokens == 4
  assert usage.cached_input_tokens == 2
  assert usage.latency_ms == 123.4


def test_image_download_timeout_is_retryable() -> None:
  from openai import APIStatusError

  response = MagicMock()
  response.status_code = 400
  response.headers = {}
  timeout_error = APIStatusError(
    "Timeout while downloading https://example.com/a.jpg",
    response=response,
    body={"error": {"code": "invalid_image_url"}},
  )
  other = APIStatusError(
    "bad schema",
    response=response,
    body={"error": {"code": "invalid_request"}},
  )

  assert isinstance(_convert_openai_error(timeout_error), VisionRetryableError)
  assert isinstance(_convert_openai_error(other), InvalidVisionResponseError)


def test_create_openai_client_wraps_with_langsmith() -> None:
  metadata = {"prompt_version": "semantic-image-v4.1", "place_id": "1"}
  with patch("langsmith.wrappers.wrap_openai", side_effect=lambda client, **_: client) as wrap_mock:
    client = _create_openai_client(
      "test-openai",
      chat_name="image 1 VLM call",
      metadata=metadata,
      tags=["semantic-image-v4.1"],
    )

  wrap_mock.assert_called_once()
  assert wrap_mock.call_args.kwargs["chat_name"] == "image 1 VLM call"
  assert wrap_mock.call_args.kwargs["tracing_extra"]["metadata"] == metadata
  assert client is not None
