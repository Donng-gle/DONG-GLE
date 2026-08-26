"""planner 통합 테스트."""

from __future__ import annotations

import json
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from course_optimizer.config import CourseOptimizerConfig
from course_optimizer.constants import DESTINATION_NODE_ID, ORIGIN_NODE_ID
from course_optimizer.models import (
  CandidatePlace,
  CourseEvaluationInfo,
  LatLng,
  PlaceFeatures,
  ResolvedOperatingHours,
  TimeSuitability,
  TravelTimeMatrix,
  TripInput,
)
from course_optimizer.planner import optimize_course
from semantic_vector.models import MajorScores


def _config() -> CourseOptimizerConfig:
  return CourseOptimizerConfig(
    openai_api_key="test",
    google_maps_api_key="test",
    qdrant_url="http://localhost:6333",
  )


def _major() -> MajorScores:
  return MajorScores(
    relaxing=0.5,
    lively=0.5,
    romantic=0.5,
    local=0.5,
    photogenic=0.5,
    traditional=0.5,
    modern=0.5,
  )


def _trip(candidates: list[CandidatePlace]) -> TripInput:
  return TripInput(
    start_time=datetime(2026, 8, 1, 9, 0),
    end_time=datetime(2026, 8, 1, 18, 0),
    transport_mode="walk",
    origin=LatLng(latitude=36.5, longitude=128.7),
    candidates=candidates,
  )


def _evaluation(candidates: list[CandidatePlace]) -> CourseEvaluationInfo:
  return CourseEvaluationInfo(
    time_suitability={
      c.place_id: TimeSuitability(morning=0.8, lunch=0.8, afternoon=0.8, evening=0.8)
      for c in candidates
    },
    transition_scores={
      a.place_id: {b.place_id: 0.8 for b in candidates if b.place_id != a.place_id}
      for a in candidates
    },
    place_features={
      c.place_id: PlaceFeatures(activity_level=0.5, rest_level=0.5) for c in candidates
    },
  )


@pytest.mark.asyncio
async def test_optimize_course_happy_path() -> None:
  candidates = [
    CandidatePlace(
      place_id="p1",
      category="관광지",
      major_scores=_major(),
      latitude=36.50,
      longitude=128.70,
      name="place1",
    ),
    CandidatePlace(
      place_id="p2",
      category="카페",
      major_scores=_major(),
      latitude=36.51,
      longitude=128.71,
      name="place2",
    ),
  ]
  matrix = TravelTimeMatrix(
    durations_minutes={
      f"{ORIGIN_NODE_ID}|p1": 10,
      f"{ORIGIN_NODE_ID}|p2": 10,
      "p1|p2": 10,
      "p2|p1": 10,
    }
  )

  with (
    patch(
      "course_optimizer.planner.ensure_open_candidates",
      AsyncMock(return_value=(candidates, {}, [])),
    ),
    patch(
      "course_optimizer.planner.fetch_operating_hours",
      AsyncMock(return_value=None),
    ),
    patch(
      "course_optimizer.planner.build_travel_time_matrix",
      AsyncMock(return_value=matrix),
    ),
    patch(
      "course_optimizer.planner.call_course_evaluation",
      AsyncMock(return_value=_evaluation(candidates)),
    ),
  ):
    result = await optimize_course(_trip(candidates), config=_config())

  assert result.selected_route.stops
  assert result.evaluated_route_count >= 1
  assert result.prompt_version == "course-evaluation-v1"
  assert result.model_name == "gpt-4.1-mini"


@pytest.mark.asyncio
async def test_optimize_course_replaces_closed_place() -> None:
  closed = CandidatePlace(
    place_id="closed",
    category="관광지",
    major_scores=_major(),
    latitude=36.50,
    longitude=128.70,
    is_open=False,
  )
  replacement = CandidatePlace(
    place_id="replacement",
    category="관광지",
    major_scores=_major(),
    latitude=36.52,
    longitude=128.72,
  )
  candidates = [
    closed,
    CandidatePlace(
      place_id="p2",
      category="카페",
      major_scores=_major(),
      latitude=36.51,
      longitude=128.71,
    ),
  ]
  open_candidates = [replacement, candidates[1]]
  matrix = TravelTimeMatrix(
    durations_minutes={
      f"{ORIGIN_NODE_ID}|replacement": 10,
      f"{ORIGIN_NODE_ID}|p2": 10,
      "replacement|p2": 10,
      "p2|replacement": 10,
    }
  )

  with (
    patch(
      "course_optimizer.planner.ensure_open_candidates",
      AsyncMock(return_value=(open_candidates, {"closed": "replacement"}, [])),
    ),
    patch(
      "course_optimizer.planner.fetch_operating_hours",
      AsyncMock(return_value=None),
    ),
    patch(
      "course_optimizer.planner.build_travel_time_matrix",
      AsyncMock(return_value=matrix),
    ),
    patch(
      "course_optimizer.planner.call_course_evaluation",
      AsyncMock(return_value=_evaluation(open_candidates)),
    ),
  ):
    result = await optimize_course(_trip(candidates), config=_config())

  assert result.replaced_places == {"closed": "replacement"}


@pytest.mark.asyncio
async def test_optimize_course_does_not_backtrack_when_llm_fails() -> None:
  candidates = [
    CandidatePlace(
      place_id="p1",
      category="관광지",
      major_scores=_major(),
      latitude=36.50,
      longitude=128.70,
    ),
    CandidatePlace(
      place_id="p2",
      category="식당",
      major_scores=_major(),
      latitude=36.51,
      longitude=128.71,
    ),
  ]

  with (
    patch(
      "course_optimizer.planner.ensure_open_candidates",
      AsyncMock(return_value=(candidates, {}, [])),
    ),
    patch(
      "course_optimizer.planner.fetch_operating_hours",
      AsyncMock(return_value=None),
    ),
    patch(
      "course_optimizer.planner.build_travel_time_matrix",
      AsyncMock(return_value=TravelTimeMatrix()),
    ),
    patch(
      "course_optimizer.planner.call_course_evaluation",
      AsyncMock(side_effect=ValueError("llm failed")),
    ),
    patch("course_optimizer.planner.search_optimal_route") as backtracking_mock,
  ):
    with pytest.raises(ValueError):
      await optimize_course(_trip(candidates), config=_config())
    backtracking_mock.assert_not_called()
