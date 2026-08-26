"""score_calculator 테스트."""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from course_optimizer.config import CourseOptimizerConfig
from course_optimizer.constants import DESTINATION_NODE_ID, ORIGIN_NODE_ID
from course_optimizer.models import (
  CourseEvaluationInfo,
  LatLng,
  PlaceFeatures,
  TimeSuitability,
  TripInput,
  VisitStop,
)
from course_optimizer.score_calculator import (
  calculate_balance_score,
  calculate_experience_score,
  calculate_time_score,
  calculate_total_score,
  calculate_total_travel_minutes,
  calculate_transition_score,
  calculate_travel_score,
)
from semantic_vector.models import MajorScores


def _config() -> CourseOptimizerConfig:
  return CourseOptimizerConfig(
    openai_api_key="test",
    google_maps_api_key="test",
    qdrant_url="http://localhost:6333",
  )


def _stops() -> list[VisitStop]:
  start = datetime(2026, 8, 1, 10, 0)
  second = datetime(2026, 8, 1, 12, 0)
  return [
    VisitStop(
      place_id="p1",
      arrival_time=start,
      visit_start_time=start,
      departure_time=start + timedelta(minutes=60),
      actual_stay_minutes=60,
    ),
    VisitStop(
      place_id="p2",
      arrival_time=second,
      visit_start_time=second,
      departure_time=second + timedelta(minutes=60),
      actual_stay_minutes=60,
    ),
  ]


def _evaluation() -> CourseEvaluationInfo:
  return CourseEvaluationInfo(
    time_suitability={
      "p1": TimeSuitability(morning=0.8, lunch=0.2, afternoon=0.2, evening=0.2),
      "p2": TimeSuitability(morning=0.2, lunch=0.9, afternoon=0.2, evening=0.2),
    },
    transition_scores={
      "p1": {"p2": 0.7},
      "p2": {"p1": 0.6},
    },
    place_features={
      "p1": PlaceFeatures(activity_level=0.8, rest_level=0.2),
      "p2": PlaceFeatures(activity_level=0.8, rest_level=0.2),
    },
  )


def test_calculate_time_score_uses_visit_start_slot() -> None:
  score = calculate_time_score(_stops(), _evaluation())
  assert score == pytest.approx((0.8 + 0.9) / 2)


def test_calculate_transition_score_average() -> None:
  score = calculate_transition_score(_stops(), _evaluation())
  assert score == 0.7


def test_balance_score_no_penalty_for_short_runs() -> None:
  evaluation = CourseEvaluationInfo(
    time_suitability=_evaluation().time_suitability,
    transition_scores=_evaluation().transition_scores,
    place_features={
      "p1": PlaceFeatures(activity_level=0.8, rest_level=0.2),
      "p2": PlaceFeatures(activity_level=0.8, rest_level=0.2),
    },
  )
  score = calculate_balance_score(
    _stops(),
    evaluation,
    config=_config(),
    categories_by_place_id={"p1": "관광지", "p2": "식당"},
  )
  assert score == 100.0


@pytest.mark.parametrize(
  ("run_length", "expected_penalty"),
  [(3, 5.0), (4, 20.0), (5, 45.0)],
)
def test_balance_score_activity_penalty(run_length: int, expected_penalty: float) -> None:
  stops = [
    VisitStop(
      place_id=f"p{i}",
      arrival_time=datetime(2026, 8, 1, 10, 0),
      visit_start_time=datetime(2026, 8, 1, 10, 0),
      departure_time=datetime(2026, 8, 1, 11, 0),
      actual_stay_minutes=60,
    )
    for i in range(run_length)
  ]
  evaluation = CourseEvaluationInfo(
    time_suitability={
      stop.place_id: TimeSuitability(morning=0.5, lunch=0.5, afternoon=0.5, evening=0.5)
      for stop in stops
    },
    transition_scores={
      a.place_id: {b.place_id: 0.8 for b in stops if b.place_id != a.place_id}
      for a in stops
    },
    place_features={
      stop.place_id: PlaceFeatures(activity_level=0.8, rest_level=0.2) for stop in stops
    },
  )
  score = calculate_balance_score(
    stops,
    evaluation,
    config=_config(),
    categories_by_place_id={stop.place_id: f"cat-{index}" for index, stop in enumerate(stops)},
  )
  assert score == 100.0 - expected_penalty


def test_balance_score_category_repeat_penalty() -> None:
  score = calculate_balance_score(
    _stops(),
    _evaluation(),
    config=_config(),
    categories_by_place_id={"p1": "식당", "p2": "식당"},
  )
  assert score == 95.0


def test_calculate_experience_score_scales_time_and_transition() -> None:
  score = calculate_experience_score(0.8, 0.7, 95.0)
  assert score == pytest.approx((80.0 + 70.0 + 95.0) / 3)


def test_travel_score_absolute_normalization() -> None:
  trip = TripInput(
    start_time=datetime(2026, 8, 1, 9, 0),
    end_time=datetime(2026, 8, 1, 19, 0),
    transport_mode="walk",
    origin=LatLng(latitude=36.5, longitude=128.7),
    candidates=[],
  )
  assert calculate_travel_score(300, trip) == 50.0
  assert calculate_travel_score(700, trip) == 0.0


def test_total_score_weighted_sum() -> None:
  config = _config()
  total = calculate_total_score(80.0, 60.0, config=config)
  assert total == 70.0


def test_total_travel_minutes_with_fixed_destination() -> None:
  trip = TripInput(
    start_time=datetime(2026, 8, 1, 9, 0),
    end_time=datetime(2026, 8, 1, 19, 0),
    transport_mode="walk",
    origin=LatLng(latitude=36.5, longitude=128.7),
    fixed_destination=LatLng(latitude=36.6, longitude=128.8),
    candidates=[],
  )
  durations = {
    f"{ORIGIN_NODE_ID}|p1": 10,
    "p1|p2": 15,
    f"p2|{DESTINATION_NODE_ID}": 20,
  }
  total = calculate_total_travel_minutes(_stops(), trip, durations)
  assert total == 45
