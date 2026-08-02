"""OpenAI Vision 호출."""

from __future__ import annotations

import json
from typing import Any

from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI, AuthenticationError

from semantic_vector.config import SemanticVectorConfig
from semantic_vector.exceptions import (
  InvalidVisionResponseError,
  VisionAuthenticationError,
  VisionRetryableError,
)
from semantic_vector.models import DetailScores, PlaceImageInput, VisionAnalysisResponse
from semantic_vector.prompt import (
  build_detail_scores_json_schema,
  build_user_prompt,
  resolve_system_prompt,
)
from semantic_vector.retry import retry_async
from semantic_vector.validators import validate_detail_score_keys, validate_score


def _parse_vision_payload(payload: dict[str, Any]) -> VisionAnalysisResponse:
  """GPT JSON 응답을 VisionAnalysisResponse로 변환한다."""
  if "detail_scores" not in payload:
    raise InvalidVisionResponseError("detail_scores field is missing")

  raw_scores = payload["detail_scores"]
  if not isinstance(raw_scores, dict):
    raise InvalidVisionResponseError("detail_scores must be an object")

  validate_detail_score_keys(raw_scores)
  validated_scores = {
    tag: validate_score(raw_scores[tag], tag)
    for tag in raw_scores
  }
  detail_scores = DetailScores(**validated_scores)
  summary = payload.get("summary")
  if summary is not None and not isinstance(summary, str):
    raise InvalidVisionResponseError("summary must be a string or null")

  return VisionAnalysisResponse(detail_scores=detail_scores, summary=summary)


def _convert_openai_error(error: Exception) -> Exception:
  """OpenAI 오류를 모듈 예외로 변환한다."""
  if isinstance(error, AuthenticationError):
    return VisionAuthenticationError(str(error))
  if isinstance(error, APITimeoutError):
    return VisionRetryableError(str(error))
  if isinstance(error, APIConnectionError):
    return VisionRetryableError(str(error))
  if isinstance(error, APIStatusError):
    if error.status_code == 429 or error.status_code >= 500:
      return VisionRetryableError(str(error))
    if error.status_code == 401:
      return VisionAuthenticationError(str(error))
    return InvalidVisionResponseError(str(error))
  return error


async def analyze_image_with_vision(
  input_data: PlaceImageInput,
  *,
  config: SemanticVectorConfig,
) -> VisionAnalysisResponse:
  """GPT Vision으로 이미지를 분석해 35개 Detail Score를 반환한다."""
  client = AsyncOpenAI(api_key=config.openai_api_key)
  schema = build_detail_scores_json_schema()

  system_prompt = resolve_system_prompt(input_data)

  async def _call() -> VisionAnalysisResponse:
    try:
      response = await client.chat.completions.create(
        model=config.openai_model,
        messages=[
          {"role": "system", "content": system_prompt},
          {
            "role": "user",
            "content": [
              {"type": "text", "text": build_user_prompt(input_data)},
              {"type": "image_url", "image_url": {"url": input_data.image_url}},
            ],
          },
        ],
        response_format={
          "type": "json_schema",
          "json_schema": {
            "name": "vision_analysis_response",
            "strict": True,
            "schema": schema,
          },
        },
      )
    except Exception as error:
      raise _convert_openai_error(error) from error

    content = response.choices[0].message.content
    if not content:
      raise InvalidVisionResponseError("empty response content")

    try:
      payload = json.loads(content)
    except json.JSONDecodeError as error:
      raise InvalidVisionResponseError("invalid JSON response") from error

    if not isinstance(payload, dict):
      raise InvalidVisionResponseError("response JSON must be an object")

    return _parse_vision_payload(payload)

  return await retry_async(
    _call,
    max_retry_count=config.max_retry_count,
    retryable_exceptions=(VisionRetryableError,),
  )
