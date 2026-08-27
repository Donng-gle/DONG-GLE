"""LLM 1회 호출."""

from __future__ import annotations

import json
from collections.abc import Sequence

from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI, AuthenticationError

from course_optimizer.config import CourseOptimizerConfig
from course_optimizer.exceptions import InvalidCourseEvaluationError
from course_optimizer.models import CandidatePlace, CourseEvaluationInfo, PlaceFeatures, TimeSuitability
from course_optimizer.prompt import (
  COURSE_EVALUATION_SYSTEM_PROMPT,
  build_evaluation_json_schema,
  build_user_prompt,
)
from course_optimizer.validators import validate_evaluation_coverage, validate_score
from semantic_vector.retry import retry_async


def _convert_openai_error(error: Exception) -> Exception:
  if isinstance(error, AuthenticationError):
    return error
  if isinstance(error, (APITimeoutError, APIConnectionError)):
    return error
  if isinstance(error, APIStatusError):
    if error.status_code in (429, 500, 502, 503, 504):
      return error
    return InvalidCourseEvaluationError(str(error))
  return error


def _parse_evaluation_payload(payload: dict) -> CourseEvaluationInfo:
  try:
    time_suitability = {
      place_id: TimeSuitability(
        morning=validate_score(values["morning"], f"{place_id}.morning"),
        lunch=validate_score(values["lunch"], f"{place_id}.lunch"),
        afternoon=validate_score(values["afternoon"], f"{place_id}.afternoon"),
        evening=validate_score(values["evening"], f"{place_id}.evening"),
        night=validate_score(values["night"], f"{place_id}.night"),
      )
      for place_id, values in payload["time_suitability"].items()
    }
    transition_scores = {
      from_id: {
        to_id: validate_score(score, f"transition.{from_id}.{to_id}")
        for to_id, score in to_scores.items()
      }
      for from_id, to_scores in payload["transition_scores"].items()
    }
    place_features = {
      place_id: PlaceFeatures(
        activity_level=validate_score(values["activity_level"], f"{place_id}.activity_level"),
        rest_level=validate_score(values["rest_level"], f"{place_id}.rest_level"),
      )
      for place_id, values in payload["place_features"].items()
    }
  except (KeyError, TypeError, ValueError) as error:
    raise InvalidCourseEvaluationError(str(error)) from error

  return CourseEvaluationInfo(
    time_suitability=time_suitability,
    transition_scores=transition_scores,
    place_features=place_features,
  )


async def call_course_evaluation(
  candidates: Sequence[CandidatePlace],
  *,
  config: CourseOptimizerConfig,
) -> CourseEvaluationInfo:
  """후보 장소 평가 정보를 LLM 1회 호출로 생성한다."""
  client = AsyncOpenAI(api_key=config.openai_api_key)
  schema = build_evaluation_json_schema(candidates)

  async def _call() -> CourseEvaluationInfo:
    try:
      response = await client.chat.completions.create(
        model=config.openai_model,
        messages=[
          {"role": "system", "content": COURSE_EVALUATION_SYSTEM_PROMPT},
          {"role": "user", "content": build_user_prompt(candidates)},
        ],
        response_format={
          "type": "json_schema",
          "json_schema": {
            "name": "course_evaluation_response",
            "strict": True,
            "schema": schema,
          },
        },
      )
    except Exception as error:
      raise _convert_openai_error(error) from error

    content = response.choices[0].message.content
    if not content:
      raise InvalidCourseEvaluationError("empty response content")

    try:
      payload = json.loads(content)
    except json.JSONDecodeError as error:
      raise InvalidCourseEvaluationError("invalid JSON response") from error

    if not isinstance(payload, dict):
      raise InvalidCourseEvaluationError("response JSON must be an object")

    evaluation = _parse_evaluation_payload(payload)
    validate_evaluation_coverage(evaluation, candidates)
    return evaluation

  return await retry_async(
    _call,
    max_retry_count=config.max_retry_count,
    retryable_exceptions=(APITimeoutError, APIConnectionError, APIStatusError),
  )
