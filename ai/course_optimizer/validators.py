"""입력 및 LLM 응답 검증."""

from __future__ import annotations

import math
from collections.abc import Sequence

from course_optimizer.exceptions import InvalidCourseEvaluationError, InvalidTripInputError
from course_optimizer.models import CandidatePlace, CourseEvaluationInfo, TripInput


def validate_score(value: float, field_name: str) -> float:
  """0.0~1.0 범위의 유한 실수인지 검증한다."""
  if not isinstance(value, (int, float)):
    raise ValueError(f"{field_name} must be a number")
  numeric = float(value)
  if not math.isfinite(numeric):
    raise ValueError(f"{field_name} must be a finite number")
  if numeric < 0.0 or numeric > 1.0:
    raise ValueError(f"{field_name} must be between 0.0 and 1.0")
  return numeric


def validate_trip_input(trip: TripInput, *, min_visit_count: int) -> None:
  """TripInput 기본 제약을 검증한다."""
  if trip.end_time <= trip.start_time:
    raise InvalidTripInputError("end_time must be after start_time")
  if len(trip.candidates) < min_visit_count:
    raise InvalidTripInputError(
      f"candidate count must be >= {min_visit_count}, got {len(trip.candidates)}"
    )
  place_ids = [candidate.place_id for candidate in trip.candidates]
  if len(place_ids) != len(set(place_ids)):
    raise InvalidTripInputError("duplicate place_id in candidates")


def validate_evaluation_coverage(
  evaluation: CourseEvaluationInfo,
  candidates: Sequence[CandidatePlace],
) -> None:
  """LLM 평가 정보가 모든 후보와 순서쌍을 포함하는지 검증한다."""
  candidate_ids = {candidate.place_id for candidate in candidates}

  for place_id in candidate_ids:
    if place_id not in evaluation.time_suitability:
      raise InvalidCourseEvaluationError(f"missing time_suitability for {place_id}")
    if place_id not in evaluation.place_features:
      raise InvalidCourseEvaluationError(f"missing place_features for {place_id}")

  for from_id in candidate_ids:
    if from_id not in evaluation.transition_scores:
      raise InvalidCourseEvaluationError(f"missing transition_scores for {from_id}")
  for from_id in candidate_ids:
    for to_id in candidate_ids:
      if from_id == to_id:
        continue
      if to_id not in evaluation.transition_scores[from_id]:
        raise InvalidCourseEvaluationError(
          f"missing transition score for {from_id} -> {to_id}"
        )

  extra_ids = set(evaluation.time_suitability) - candidate_ids
  if extra_ids:
    raise InvalidCourseEvaluationError(f"unknown place_id in evaluation: {sorted(extra_ids)}")
