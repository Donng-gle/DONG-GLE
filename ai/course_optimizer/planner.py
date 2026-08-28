"""여행 코스 최적화 진입점."""

from __future__ import annotations

import logging
from datetime import datetime

from course_optimizer.backtracking import search_optimal_route
from course_optimizer.config import CourseOptimizerConfig
from course_optimizer.exceptions import ReplacementNotFoundError
from course_optimizer.llm_client import call_course_evaluation
from course_optimizer.models import CandidatePlace, CourseOptimizationResult, TripInput
from course_optimizer.operating_hours import resolve_operating_hours
from course_optimizer.places_client import fetch_business_status, fetch_operating_hours
from course_optimizer.replacement_client import find_replacement_place
from course_optimizer.routes_client import build_travel_time_matrix
from course_optimizer.validators import validate_trip_input

logger = logging.getLogger(__name__)


async def ensure_open_candidates(
  candidates: list[CandidatePlace],
  *,
  visit_time: datetime,
  config: CourseOptimizerConfig,
) -> tuple[list[CandidatePlace], dict[str, str], list[str]]:
  """영업 중단 장소를 대체하거나 제외한다."""
  resolved: list[CandidatePlace] = []
  replaced: dict[str, str] = {}
  excluded: list[str] = []
  exclude_ids: set[str] = set()

  for candidate in candidates:
    is_open = candidate.is_open
    if is_open:
      is_open = await fetch_business_status(candidate, config=config)

    current = candidate.model_copy(update={"is_open": is_open})
    if current.is_open:
      resolved.append(current)
      exclude_ids.add(current.place_id)
      continue

    try:
      replacement = await find_replacement_place(
        current,
        exclude_ids,
        visit_time=visit_time,
        config=config,
      )
    except ReplacementNotFoundError:
      logger.warning("replacement not found for place_id=%s", current.place_id)
      excluded.append(current.place_id)
      continue

    replaced[current.place_id] = replacement.place_id
    resolved.append(replacement)
    exclude_ids.add(replacement.place_id)

  return resolved, replaced, excluded


async def optimize_course(
  trip: TripInput,
  *,
  config: CourseOptimizerConfig | None = None,
) -> CourseOptimizationResult:
  """여행 코스 최적화를 수행한다."""
  resolved_config = config or CourseOptimizerConfig()
  validate_trip_input(trip, min_visit_count=resolved_config.min_visit_count)

  candidates, replaced, excluded = await ensure_open_candidates(
    list(trip.candidates),
    visit_time=trip.start_time,
    config=resolved_config,
  )
  if len(candidates) < resolved_config.min_visit_count:
    from course_optimizer.exceptions import InvalidTripInputError

    raise InvalidTripInputError(
      "not enough candidates after replacement/exclusion"
    )

  candidate_map = {candidate.place_id: candidate for candidate in candidates}
  resolved_hours = {}
  for place_id, candidate in candidate_map.items():
    raw_hours = await fetch_operating_hours(
      place_id,
      candidate=candidate,
      visit_time=trip.start_time,
      config=resolved_config,
    )
    resolved_hours[place_id] = resolve_operating_hours(candidate.category, raw_hours)

  optimized_trip = trip.model_copy(update={"candidates": candidates})
  travel_matrix = await build_travel_time_matrix(optimized_trip, config=resolved_config)
  evaluation = await call_course_evaluation(candidates, config=resolved_config)

  search_result = search_optimal_route(
    optimized_trip,
    candidates,
    resolved_hours,
    travel_matrix,
    evaluation,
    config=resolved_config,
  )

  return CourseOptimizationResult(
    selected_route=search_result.selected_route,
    candidate_route_count=search_result.candidate_route_count,
    evaluated_route_count=search_result.evaluated_route_count,
    target_visit_count=search_result.target_visit_count,
    free_time_minutes=search_result.free_time_minutes,
    prompt_version=resolved_config.prompt_version,
    model_name=resolved_config.openai_model,
    excluded_place_ids=excluded,
    excluded_places=search_result.excluded_places,
    exclusion_reason=search_result.exclusion_reason,
    replaced_places=replaced,
  )
