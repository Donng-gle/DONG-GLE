"""llm_client 테스트."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from course_optimizer.config import CourseOptimizerConfig
from course_optimizer.exceptions import InvalidCourseEvaluationError
from course_optimizer.llm_client import call_course_evaluation
from course_optimizer.models import CandidatePlace
from course_optimizer.prompt import COURSE_EVALUATION_SYSTEM_PROMPT
from semantic_vector.models import MajorScores


def _config() -> CourseOptimizerConfig:
  return CourseOptimizerConfig(
    openai_api_key="test",
    google_maps_api_key="test",
    qdrant_url="http://localhost:6333",
  )


def _candidate(place_id: str) -> CandidatePlace:
  return CandidatePlace(
    place_id=place_id,
    category="관광지",
    major_scores=MajorScores(
      relaxing=0.5,
      lively=0.5,
      romantic=0.5,
      local=0.5,
      photogenic=0.5,
      traditional=0.5,
      modern=0.5,
    ),
    latitude=36.5,
    longitude=128.7,
  )


def _payload() -> dict:
  return {
    "time_suitability": {
      "p1": {"morning": 0.8, "lunch": 0.7, "afternoon": 0.6, "evening": 0.5, "night": 0.4},
      "p2": {"morning": 0.4, "lunch": 0.9, "afternoon": 0.6, "evening": 0.5, "night": 0.3},
    },
    "transition_scores": {
      "p1": {"p2": 0.85},
      "p2": {"p1": 0.75},
    },
    "place_features": {
      "p1": {"activity_level": 0.6, "rest_level": 0.4},
      "p2": {"activity_level": 0.7, "rest_level": 0.3},
    },
  }


@pytest.mark.asyncio
async def test_call_course_evaluation_parses_response() -> None:
  candidates = [_candidate("p1"), _candidate("p2")]
  message = MagicMock()
  message.content = json.dumps(_payload())
  response = MagicMock()
  response.choices = [MagicMock(message=message)]
  create_mock = AsyncMock(return_value=response)
  client_mock = MagicMock()
  client_mock.chat.completions.create = create_mock

  with patch("course_optimizer.llm_client.AsyncOpenAI", return_value=client_mock):
    evaluation = await call_course_evaluation(candidates, config=_config())

  assert evaluation.transition_scores["p1"]["p2"] == 0.85
  messages = create_mock.await_args.kwargs["messages"]
  assert messages[0]["content"] == COURSE_EVALUATION_SYSTEM_PROMPT
  assert "lively" in messages[0]["content"]
  assert "0.85~0.90" in messages[0]["content"]


@pytest.mark.asyncio
async def test_call_course_evaluation_invalid_json() -> None:
  candidates = [_candidate("p1"), _candidate("p2")]
  message = MagicMock()
  message.content = "not-json"
  response = MagicMock()
  response.choices = [MagicMock(message=message)]
  client_mock = MagicMock()
  client_mock.chat.completions.create = AsyncMock(return_value=response)

  with patch("course_optimizer.llm_client.AsyncOpenAI", return_value=client_mock):
    with pytest.raises(InvalidCourseEvaluationError):
      await call_course_evaluation(candidates, config=_config())
