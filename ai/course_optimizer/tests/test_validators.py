"""validators 테스트."""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from course_optimizer.exceptions import InvalidCourseEvaluationError, InvalidTripInputError
from course_optimizer.models import (
  CandidatePlace,
  CourseEvaluationInfo,
  LatLng,
  PlaceFeatures,
  TimeSuitability,
  TripInput,
)
from course_optimizer.validators import (
  validate_evaluation_coverage,
  validate_score,
  validate_trip_input,
)
from semantic_vector.models import MajorScores


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


def _candidate(place_id: str) -> CandidatePlace:
  return CandidatePlace(
    place_id=place_id,
    category="관광지",
    major_scores=_major(),
    latitude=36.5,
    longitude=128.7,
  )


def _trip(candidates: list[CandidatePlace] | None = None) -> TripInput:
  return TripInput(
    start_time=datetime(2026, 8, 1, 9, 0),
    end_time=datetime(2026, 8, 1, 18, 0),
    transport_mode="walk",
    origin=LatLng(latitude=36.5, longitude=128.7),
    candidates=candidates or [_candidate("p1"), _candidate("p2")],
  )


def test_validate_score_ok() -> None:
  assert validate_score(0.42, "x") == 0.42


@pytest.mark.parametrize("value", [-0.1, 1.1, float("nan"), float("inf")])
def test_validate_score_invalid(value: float) -> None:
  with pytest.raises(ValueError):
    validate_score(value, "x")


def test_validate_trip_input_ok() -> None:
  validate_trip_input(_trip(), min_visit_count=2)


def test_validate_trip_input_end_before_start() -> None:
  trip = _trip()
  trip = trip.model_copy(update={"end_time": trip.start_time})
  with pytest.raises(InvalidTripInputError):
    validate_trip_input(trip, min_visit_count=2)


def test_validate_trip_input_not_enough_candidates() -> None:
  with pytest.raises(InvalidTripInputError):
    validate_trip_input(_trip([_candidate("p1")]), min_visit_count=2)


def test_validate_trip_input_duplicate_place_id() -> None:
  with pytest.raises(InvalidTripInputError):
    validate_trip_input(_trip([_candidate("p1"), _candidate("p1")]), min_visit_count=2)


def _evaluation_for(candidates: list[CandidatePlace]) -> CourseEvaluationInfo:
  time_suitability = {
    c.place_id: TimeSuitability(morning=0.5, lunch=0.5, afternoon=0.5, evening=0.5)
    for c in candidates
  }
  place_features = {
    c.place_id: PlaceFeatures(activity_level=0.5, rest_level=0.5) for c in candidates
  }
  transition_scores = {
    a.place_id: {
      b.place_id: 0.8 for b in candidates if b.place_id != a.place_id
    }
    for a in candidates
  }
  return CourseEvaluationInfo(
    time_suitability=time_suitability,
    transition_scores=transition_scores,
    place_features=place_features,
  )


def test_validate_evaluation_coverage_ok() -> None:
  candidates = [_candidate("p1"), _candidate("p2")]
  validate_evaluation_coverage(_evaluation_for(candidates), candidates)


def test_validate_evaluation_missing_time_suitability() -> None:
  candidates = [_candidate("p1"), _candidate("p2")]
  evaluation = _evaluation_for(candidates)
  evaluation.time_suitability.pop("p2")
  with pytest.raises(InvalidCourseEvaluationError):
    validate_evaluation_coverage(evaluation, candidates)


def test_validate_evaluation_missing_transition() -> None:
  candidates = [_candidate("p1"), _candidate("p2")]
  evaluation = _evaluation_for(candidates)
  evaluation.transition_scores["p1"].pop("p2")
  with pytest.raises(InvalidCourseEvaluationError):
    validate_evaluation_coverage(evaluation, candidates)
