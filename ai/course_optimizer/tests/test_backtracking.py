"""backtracking 테스트."""

from __future__ import annotations

from datetime import datetime, time, timedelta

import pytest

from course_optimizer.backtracking import (
  calculate_free_time_minutes,
  search_optimal_route,
)
from course_optimizer.config import CourseOptimizerConfig
from course_optimizer.constants import DESTINATION_NODE_ID, ORIGIN_NODE_ID
from course_optimizer.exceptions import NoFeasibleRouteError
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
from semantic_vector.models import MajorScores


def _config() -> CourseOptimizerConfig:
  return CourseOptimizerConfig(
    openai_api_key="test",
    google_maps_api_key="test",
    qdrant_url="http://localhost:6333",
    min_visit_count=2,
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


def _candidates() -> list[CandidatePlace]:
  return [
    CandidatePlace(
      place_id="p1",
      category="관광지",
      major_scores=_major(),
      latitude=36.50,
      longitude=128.70,
    ),
    CandidatePlace(
      place_id="p2",
      category="카페",
      major_scores=_major(),
      latitude=36.51,
      longitude=128.71,
    ),
  ]


def _evaluation(candidates: list[CandidatePlace]) -> CourseEvaluationInfo:
  return CourseEvaluationInfo(
    time_suitability={
      c.place_id: TimeSuitability(
        morning=0.8, lunch=0.8, afternoon=0.8, evening=0.8, night=0.8
      )
      for c in candidates
    },
    transition_scores={
      a.place_id: {b.place_id: 0.8 for b in candidates if b.place_id != a.place_id}
      for a in candidates
    },
    place_features={
      c.place_id: PlaceFeatures(activity_level=0.9, rest_level=0.9) for c in candidates
    },
  )


def _hours() -> dict[str, ResolvedOperatingHours]:
  return {
    "p1": ResolvedOperatingHours(is_always_open=True),
    "p2": ResolvedOperatingHours(is_always_open=True),
  }


def _matrix() -> TravelTimeMatrix:
  return TravelTimeMatrix(
    durations_minutes={
      f"{ORIGIN_NODE_ID}|p1": 10,
      f"{ORIGIN_NODE_ID}|p2": 10,
      "p1|p2": 10,
      "p2|p1": 10,
    }
  )


def _trip(candidates: list[CandidatePlace] | None = None) -> TripInput:
  return TripInput(
    start_time=datetime(2026, 8, 1, 9, 0),
    end_time=datetime(2026, 8, 1, 18, 0),
    transport_mode="walk",
    origin=LatLng(latitude=36.5, longitude=128.7),
    candidates=candidates or _candidates(),
  )


def test_search_optimal_route_finds_feasible_path() -> None:
  candidates = _candidates()
  result = search_optimal_route(
    _trip(candidates),
    candidates,
    _hours(),
    _matrix(),
    _evaluation(candidates),
    config=_config(),
  )
  assert len(result.selected_route.stops) >= 2
  assert result.evaluated_route_count >= 1
  assert result.candidate_route_count >= 1


def test_search_optimal_route_prunes_closed_place() -> None:
  candidates = _candidates() + [
    CandidatePlace(
      place_id="p3",
      category="카페",
      major_scores=_major(),
      latitude=36.52,
      longitude=128.72,
    )
  ]
  hours = {
    "p1": ResolvedOperatingHours(
      open_time=time(9, 0),
      close_time=time(9, 15),
      is_always_open=False,
    ),
    "p2": ResolvedOperatingHours(is_always_open=True),
    "p3": ResolvedOperatingHours(is_always_open=True),
  }
  matrix = TravelTimeMatrix(
    durations_minutes={
      f"{ORIGIN_NODE_ID}|p1": 10,
      f"{ORIGIN_NODE_ID}|p2": 10,
      f"{ORIGIN_NODE_ID}|p3": 10,
      "p1|p2": 10,
      "p1|p3": 10,
      "p2|p1": 10,
      "p2|p3": 10,
      "p3|p1": 10,
      "p3|p2": 10,
    }
  )
  result = search_optimal_route(
    _trip(candidates),
    candidates,
    hours,
    matrix,
    _evaluation(candidates),
    config=_config(),
  )
  assert all(stop.place_id != "p1" for stop in result.selected_route.stops)


def test_search_optimal_route_requires_min_visit_count() -> None:
  candidates = _candidates()
  trip = _trip(candidates).model_copy(
    update={"end_time": datetime(2026, 8, 1, 9, 20)}
  )
  with pytest.raises(NoFeasibleRouteError):
    search_optimal_route(
      trip,
      candidates,
      _hours(),
      _matrix(),
      _evaluation(candidates),
      config=_config(),
    )


def test_balance_does_not_prune_high_activity_routes() -> None:
  candidates = _candidates()
  result = search_optimal_route(
    _trip(candidates),
    candidates,
    _hours(),
    _matrix(),
    _evaluation(candidates),
    config=_config(),
  )
  assert result.evaluated_route_count >= 1
  assert result.selected_route.score.balance_score <= 100.0


def test_fixed_destination_prunes_unreachable_route() -> None:
  candidates = _candidates()
  trip = TripInput(
    start_time=datetime(2026, 8, 1, 9, 0),
    end_time=datetime(2026, 8, 1, 10, 0),
    transport_mode="walk",
    origin=LatLng(latitude=36.5, longitude=128.7),
    fixed_destination=LatLng(latitude=37.0, longitude=129.0),
    candidates=candidates,
  )
  durations: dict[str, int] = {}
  for c in candidates:
    durations[f"{ORIGIN_NODE_ID}|{c.place_id}"] = 10
    durations[f"{c.place_id}|{DESTINATION_NODE_ID}"] = 120
    for other in candidates:
      if c.place_id != other.place_id:
        durations[f"{c.place_id}|{other.place_id}"] = 10
  matrix = TravelTimeMatrix(durations_minutes=durations)
  with pytest.raises(NoFeasibleRouteError):
    search_optimal_route(
      trip,
      candidates,
      _hours(),
      matrix,
      _evaluation(candidates),
      config=_config(),
    )


def _andong_candidates() -> list[CandidatePlace]:
  return [
    CandidatePlace(
      place_id="minsok",
      category="관광지",
      major_scores=_major(),
      latitude=36.54,
      longitude=128.52,
      name="안동민속촌",
    ),
    CandidatePlace(
      place_id="yuha",
      category="관광지",
      major_scores=_major(),
      latitude=36.56,
      longitude=128.58,
      name="유하사",
    ),
    CandidatePlace(
      place_id="cafe",
      category="카페",
      major_scores=_major(),
      latitude=36.57,
      longitude=128.51,
      name="카페뒤뜰",
    ),
    CandidatePlace(
      place_id="maenggae",
      category="관광지",
      major_scores=_major(),
      latitude=36.58,
      longitude=128.49,
      name="맹개마을",
    ),
    CandidatePlace(
      place_id="jangseung",
      category="관광지",
      major_scores=_major(),
      latitude=36.55,
      longitude=128.50,
      name="안동 장승공원",
    ),
  ]


def _andong_hours() -> dict[str, ResolvedOperatingHours]:
  return {place_id: ResolvedOperatingHours(is_always_open=True) for place_id in [
    "minsok",
    "yuha",
    "cafe",
    "maenggae",
    "jangseung",
  ]}


def _andong_matrix() -> TravelTimeMatrix:
  place_ids = ["minsok", "yuha", "cafe", "maenggae", "jangseung"]
  origin_travel = {
    "minsok": 6,
    "yuha": 13,
    "cafe": 23,
    "maenggae": 44,
    "jangseung": 30,
  }
  pair_travel = {
    ("minsok", "yuha"): 18,
    ("minsok", "cafe"): 20,
    ("minsok", "maenggae"): 40,
    ("minsok", "jangseung"): 28,
    ("yuha", "cafe"): 15,
    ("yuha", "maenggae"): 30,
    ("yuha", "jangseung"): 20,
    ("cafe", "maenggae"): 25,
    ("cafe", "jangseung"): 18,
    ("maenggae", "jangseung"): 22,
  }
  durations: dict[str, int] = {}
  for place_id, minutes in origin_travel.items():
    durations[f"{ORIGIN_NODE_ID}|{place_id}"] = minutes
    durations[f"{place_id}|{ORIGIN_NODE_ID}"] = minutes
  for (from_id, to_id), minutes in pair_travel.items():
    durations[f"{from_id}|{to_id}"] = minutes
    durations[f"{to_id}|{from_id}"] = minutes
  for from_id in place_ids:
    for to_id in place_ids:
      if from_id != to_id and f"{from_id}|{to_id}" not in durations:
        durations[f"{from_id}|{to_id}"] = 20
  return TravelTimeMatrix(durations_minutes=durations)


def _andong_trip(end_hour: int) -> TripInput:
  return TripInput(
    start_time=datetime(2026, 8, 1, 9, 0),
    end_time=datetime(2026, 8, 1, end_hour, 0),
    transport_mode="car",
    origin=LatLng(latitude=36.558, longitude=128.729),
    candidates=_andong_candidates(),
  )


def test_k_priority_prefers_full_visit_count_for_nine_hours() -> None:
  candidates = _andong_candidates()
  result = search_optimal_route(
    _andong_trip(18),
    candidates,
    _andong_hours(),
    _andong_matrix(),
    _evaluation(candidates),
    config=_config(),
  )
  assert result.target_visit_count == 5
  assert len(result.selected_route.stops) == 5
  assert result.excluded_places == []
  assert result.exclusion_reason == {}


def test_k_priority_keeps_default_stay_and_reports_free_time_for_eleven_hours() -> None:
  candidates = _andong_candidates()
  result = search_optimal_route(
    _andong_trip(20),
    candidates,
    _andong_hours(),
    _andong_matrix(),
    _evaluation(candidates),
    config=_config(),
  )
  assert result.target_visit_count == 5
  assert len(result.selected_route.stops) == 5
  assert all(stop.actual_stay_minutes <= 90 for stop in result.selected_route.stops)
  assert result.free_time_minutes > 0
  expected_free = calculate_free_time_minutes(
    _andong_trip(20),
    result.selected_route.stops,
    _andong_matrix(),
  )
  assert result.free_time_minutes == expected_free


def test_k_priority_reduces_visit_count_and_reports_exclusions_for_three_hours() -> None:
  candidates = _andong_candidates()
  result = search_optimal_route(
    _andong_trip(12),
    candidates,
    _andong_hours(),
    _andong_matrix(),
    _evaluation(candidates),
    config=_config(),
  )
  assert result.target_visit_count < 5
  assert len(result.selected_route.stops) == result.target_visit_count
  assert result.excluded_places
  assert len(result.exclusion_reason) == len(result.excluded_places)


def test_k_priority_raises_when_even_min_visit_count_is_impossible() -> None:
  candidates = _andong_candidates()
  trip = _andong_trip(9).model_copy(update={"end_time": datetime(2026, 8, 1, 9, 30)})
  with pytest.raises(NoFeasibleRouteError):
    search_optimal_route(
      trip,
      candidates,
      _andong_hours(),
      _andong_matrix(),
      _evaluation(candidates),
      config=_config(),
    )


def test_k_priority_does_not_compare_shorter_routes_when_full_route_exists() -> None:
  candidates = _andong_candidates()
  result = search_optimal_route(
    _andong_trip(18),
    candidates,
    _andong_hours(),
    _andong_matrix(),
    _evaluation(candidates),
    config=_config(),
  )
  assert result.target_visit_count == 5
  # k=5만 탐색하므로 2~4곳 경로는 후보에 포함되지 않는다.
  assert result.evaluated_route_count <= 120


def _count_legacy_all_k_evaluations(
  trip: TripInput,
  candidates: list[CandidatePlace],
  resolved_hours: dict[str, ResolvedOperatingHours],
  matrix: TravelTimeMatrix,
  evaluation: CourseEvaluationInfo,
  *,
  config: CourseOptimizerConfig,
) -> int:
  """기존 방식(2~N곡 부분 경로 동시 탐색)의 평가 경로 수를 계산한다."""
  from course_optimizer.backtracking import _build_stops
  from course_optimizer.score_calculator import build_scored_route

  candidate_map = {candidate.place_id: candidate for candidate in candidates}
  categories_by_place_id = {
    candidate.place_id: candidate.category for candidate in candidates
  }
  evaluated_count = 0

  def dfs(
    current_time: datetime,
    current_node: str,
    visited: list[str],
    remaining_ids: set[str],
  ) -> None:
    nonlocal evaluated_count

    if len(visited) >= config.min_visit_count:
      stops = _build_stops(trip, visited, candidate_map, resolved_hours, matrix)
      if stops is not None:
        evaluated_count += 1
        build_scored_route(
          stops,
          trip,
          evaluation,
          matrix,
          categories_by_place_id,
          config=config,
        )

    if not remaining_ids:
      return

    for place_id in sorted(remaining_ids):
      from course_optimizer.operating_hours import (
        calculate_actual_stay_minutes,
        get_default_stay_minutes,
        get_min_stay_minutes,
        is_open_at,
      )

      candidate = candidate_map[place_id]
      hours = resolved_hours[place_id]
      travel_minutes = matrix.get_minutes(current_node, place_id)
      arrival_time = current_time + timedelta(minutes=travel_minutes)
      if arrival_time > trip.end_time:
        continue
      if not is_open_at(arrival_time, hours):
        continue

      default_stay = get_default_stay_minutes(candidate.category)
      min_stay = get_min_stay_minutes(candidate.category)
      actual_stay = calculate_actual_stay_minutes(
        default_stay,
        min_stay,
        arrival_time,
        hours,
      )
      if actual_stay is None:
        continue

      departure_time = arrival_time + timedelta(minutes=actual_stay)
      if departure_time > trip.end_time:
        continue

      next_remaining = set(remaining_ids)
      next_remaining.remove(place_id)
      dfs(departure_time, place_id, visited + [place_id], next_remaining)

  dfs(
    trip.start_time,
    ORIGIN_NODE_ID,
    [],
    {candidate.place_id for candidate in candidates},
  )
  return evaluated_count


def test_k_priority_search_is_faster_when_full_route_exists() -> None:
  """k=N에서 성공하면 k<N 탐색을 생략하므로 기존 전체 k 동시 탐색보다 평가 수가 적다."""
  candidates = _andong_candidates()
  trip = _andong_trip(18)
  matrix = _andong_matrix()
  hours = _andong_hours()
  evaluation = _evaluation(candidates)
  config = _config()

  result = search_optimal_route(
    trip,
    candidates,
    hours,
    matrix,
    evaluation,
    config=config,
  )
  legacy_evaluated = _count_legacy_all_k_evaluations(
    trip,
    candidates,
    hours,
    matrix,
    evaluation,
    config=config,
  )

  assert result.target_visit_count == 5
  assert result.evaluated_route_count < legacy_evaluated
