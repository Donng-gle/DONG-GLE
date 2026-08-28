"""여행 경험/이동 효율/종합 점수 계산."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import timedelta

from course_optimizer.config import CourseOptimizerConfig
from course_optimizer.constants import DESTINATION_NODE_ID, ORIGIN_NODE_ID
from course_optimizer.models import (
  CourseEvaluationInfo,
  RouteScoreBreakdown,
  ScoredRoute,
  TravelTimeMatrix,
  TripInput,
  VisitStop,
)
from course_optimizer.operating_hours import get_time_slot


def calculate_time_score(
  stops: Sequence[VisitStop],
  evaluation: CourseEvaluationInfo,
) -> float:
  """방문 시작 시각 기준 시간대 적합도 평균."""
  if not stops:
    return 0.0
  total = 0.0
  for stop in stops:
    slot = get_time_slot(stop.visit_start_time)
    suitability = evaluation.time_suitability[stop.place_id]
    total += getattr(suitability, slot)
  return total / len(stops)


def calculate_transition_score(
  stops: Sequence[VisitStop],
  evaluation: CourseEvaluationInfo,
) -> float:
  """연속 구간 전이 적합도 평균."""
  if len(stops) < 2:
    return 0.0
  total = 0.0
  for prev_stop, next_stop in zip(stops, stops[1:]):
    total += evaluation.transition_scores[prev_stop.place_id][next_stop.place_id]
  return total / (len(stops) - 1)


def calculate_balance_score(
  stops: Sequence[VisitStop],
  evaluation: CourseEvaluationInfo,
  *,
  config: CourseOptimizerConfig,
  categories_by_place_id: dict[str, str],
) -> float:
  """활동/휴식 연속 및 category 반복 페널티를 반영한 균형 점수."""
  if not stops:
    return 0.0

  activity_run = 0
  rest_run = 0
  penalty_activity = 0.0
  penalty_rest = 0.0
  category_repeat_penalty = 0.0

  prev_category: str | None = None
  for stop in stops:
    features = evaluation.place_features[stop.place_id]
    if features.activity_level >= 0.7:
      activity_run += 1
    else:
      penalty_activity += config.balance_penalty_k1 * max(0, activity_run - 2) ** 2
      activity_run = 0

    if features.rest_level >= 0.7:
      rest_run += 1
    else:
      penalty_rest += config.balance_penalty_k2 * max(0, rest_run - 2) ** 2
      rest_run = 0

    category = categories_by_place_id[stop.place_id]
    if prev_category is not None and category == prev_category:
      category_repeat_penalty += config.category_repeat_penalty
    prev_category = category

  penalty_activity += config.balance_penalty_k1 * max(0, activity_run - 2) ** 2
  penalty_rest += config.balance_penalty_k2 * max(0, rest_run - 2) ** 2

  return max(
    0.0,
    100.0 - penalty_activity - penalty_rest - category_repeat_penalty,
  )


def calculate_experience_score(
  time_score: float,
  transition_score: float,
  balance_score: float,
) -> float:
  """여행 경험 점수.

  TimeScore·TransitionScore(0~1)를 100점 척도로 환산해 BalanceScore와 균형을 맞춘다.
  """
  return (time_score * 100 + transition_score * 100 + balance_score) / 3


def calculate_total_travel_minutes(
  stops: Sequence[VisitStop],
  trip: TripInput,
  travel_matrix: TravelTimeMatrix,
) -> int:
  """총 이동시간(분)을 계산한다."""
  if not stops:
    return 0

  total = travel_matrix.get_minutes(ORIGIN_NODE_ID, stops[0].place_id)
  for prev_stop, next_stop in zip(stops, stops[1:]):
    total += travel_matrix.get_minutes(prev_stop.place_id, next_stop.place_id)
  if trip.fixed_destination is not None:
    total += travel_matrix.get_minutes(stops[-1].place_id, DESTINATION_NODE_ID)
  return total


def calculate_travel_score(
  total_travel_minutes: int,
  trip: TripInput,
) -> float:
  """전체 여행 가능시간 대비 절대 기준 이동 효율 점수."""
  available_minutes = int((trip.end_time - trip.start_time).total_seconds() // 60)
  if available_minutes <= 0:
    return 0.0
  ratio = total_travel_minutes / available_minutes
  return 100.0 * max(0.0, 1.0 - ratio)


def calculate_total_score(
  experience_score: float,
  travel_score: float,
  *,
  config: CourseOptimizerConfig,
) -> float:
  """종합 점수."""
  return (
    config.experience_weight * experience_score
    + config.travel_weight * travel_score
  )


def score_route(
  stops: Sequence[VisitStop],
  trip: TripInput,
  evaluation: CourseEvaluationInfo,
  travel_matrix: TravelTimeMatrix,
  categories_by_place_id: dict[str, str],
  *,
  config: CourseOptimizerConfig,
) -> RouteScoreBreakdown:
  """단일 경로의 점수 breakdown을 계산한다."""
  time_score = calculate_time_score(stops, evaluation)
  transition_score = calculate_transition_score(stops, evaluation)
  balance_score = calculate_balance_score(
    stops,
    evaluation,
    config=config,
    categories_by_place_id=categories_by_place_id,
  )
  experience_score = calculate_experience_score(
    time_score,
    transition_score,
    balance_score,
  )
  total_travel_minutes = calculate_total_travel_minutes(
    stops,
    trip,
    travel_matrix,
  )
  travel_score = calculate_travel_score(total_travel_minutes, trip)
  total_score = calculate_total_score(experience_score, travel_score, config=config)
  return RouteScoreBreakdown(
    time_score=time_score,
    transition_score=transition_score,
    balance_score=balance_score,
    experience_score=experience_score,
    total_travel_minutes=total_travel_minutes,
    travel_score=travel_score,
    total_score=total_score,
  )


def build_scored_route(
  stops: Sequence[VisitStop],
  trip: TripInput,
  evaluation: CourseEvaluationInfo,
  travel_matrix: TravelTimeMatrix,
  categories_by_place_id: dict[str, str],
  *,
  config: CourseOptimizerConfig,
) -> ScoredRoute:
  """VisitStop 목록을 ScoredRoute로 변환한다."""
  return ScoredRoute(
    stops=list(stops),
    score=score_route(
      stops,
      trip,
      evaluation,
      travel_matrix,
      categories_by_place_id,
      config=config,
    ),
  )
