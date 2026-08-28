"""OpenAI Vision 호출."""

from __future__ import annotations

import json
import time
from typing import Any

from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI, AuthenticationError

from semantic_vector.config import SemanticVectorConfig
from semantic_vector.exceptions import (
  InvalidVisionResponseError,
  VisionAuthenticationError,
  VisionRetryableError,
)
from semantic_vector.models import DetailScores, PlaceImageInput, VisionAnalysisResponse, VisionCallUsage
from semantic_vector.prompt import (
  build_detail_scores_json_schema,
  build_user_prompt,
  resolve_system_prompt,
)
from semantic_vector.retry import retry_async
from semantic_vector.tracing import build_trace_metadata, build_trace_tags
from semantic_vector.validators import validate_detail_score_keys, validate_score


def _create_openai_client(
  api_key: str,
  *,
  chat_name: str = "SemanticVision",
  metadata: dict[str, Any] | None = None,
  tags: list[str] | None = None,
) -> AsyncOpenAI:
  """OpenAI 클라이언트를 생성한다. LangSmith가 설치되어 있으면 tracing wrapper를 적용한다."""
  client = AsyncOpenAI(api_key=api_key)
  try:
    from langsmith.wrappers import wrap_openai
  except ImportError:
    return client

  tracing_extra: dict[str, Any] = {}
  if metadata:
    tracing_extra["metadata"] = metadata
  if tags:
    tracing_extra["tags"] = tags
  return wrap_openai(
    client,
    chat_name=chat_name,
    tracing_extra=tracing_extra or None,
  )


def extract_usage_from_response(
  response: Any,
  *,
  latency_ms: float,
  success: bool = True,
  error: Exception | None = None,
) -> VisionCallUsage:
  """OpenAI Chat Completions response에서 실제 usage를 추출한다."""
  usage = getattr(response, "usage", None)
  prompt_details = getattr(usage, "prompt_tokens_details", None) if usage is not None else None
  return VisionCallUsage(
    input_tokens=getattr(usage, "prompt_tokens", None) if usage is not None else None,
    output_tokens=getattr(usage, "completion_tokens", None) if usage is not None else None,
    total_tokens=getattr(usage, "total_tokens", None) if usage is not None else None,
    cached_input_tokens=getattr(prompt_details, "cached_tokens", None),
    latency_ms=latency_ms,
    success=success,
    error_type=type(error).__name__ if error is not None else None,
    error_message=str(error) if error is not None else None,
  )


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
    if error.status_code == 400 and "Timeout while downloading" in str(error):
      return VisionRetryableError(str(error))
    return InvalidVisionResponseError(str(error))
  return error


async def analyze_image_with_vision(
  input_data: PlaceImageInput,
  *,
  config: SemanticVectorConfig,
  image_index: int = 1,
) -> VisionAnalysisResponse:
  """GPT Vision으로 이미지를 분석해 35개 Detail Score를 반환한다."""
  metadata = build_trace_metadata(
    input_data,
    config=config,
    image_index=image_index,
  )
  client = _create_openai_client(
    config.openai_api_key,
    chat_name=f"image {image_index} VLM call",
    metadata=metadata,
    tags=build_trace_tags(config),
  )
  schema = build_detail_scores_json_schema()

  system_prompt = resolve_system_prompt(
    input_data,
    prompt_version=config.prompt_version,
  )

  async def _call() -> VisionAnalysisResponse:
    started_at = time.perf_counter()
    response = None
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
      converted = _convert_openai_error(error)
      raise converted from error

    latency_ms = (time.perf_counter() - started_at) * 1000
    usage = extract_usage_from_response(response, latency_ms=latency_ms, success=True)

    content = response.choices[0].message.content
    if not content:
      raise InvalidVisionResponseError("empty response content")

    try:
      payload = json.loads(content)
    except json.JSONDecodeError as error:
      raise InvalidVisionResponseError("invalid JSON response") from error

    if not isinstance(payload, dict):
      raise InvalidVisionResponseError("response JSON must be an object")

    parsed = _parse_vision_payload(payload)
    return parsed.model_copy(update={"usage": usage})

  return await retry_async(
    _call,
    max_retry_count=config.max_retry_count,
    retryable_exceptions=(VisionRetryableError,),
  )
