"""백트래킹 기반 방문 순서 탐색."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence
from datetime import datetime, timedelta

from course_optimizer.config import CourseOptimizerConfig
from course_optimizer.constants import DESTINATION_NODE_ID, ORIGIN_NODE_ID
from course_optimizer.exceptions import NoFeasibleRouteError
from course_optimizer.models import (
  CandidatePlace,
  CourseEvaluationInfo,
  ResolvedOperatingHours,
  RouteSearchResult,
  ScoredRoute,
  TravelTimeMatrix,
  TripInput,
  VisitStop,
)
from course_optimizer.operating_hours import (
  calculate_actual_stay_minutes,
  get_default_stay_minutes,
  get_min_stay_minutes,
  is_open_at,
)
from course_optimizer.score_calculator import build_scored_route

PRUNE_REASON_MESSAGES = {
  "time_exceeded": "이동시간 초과로 시간 내 방문 불가",
  "closed_hours": "영업시간 외 도착으로 방문 불가",
  "insufficient_stay": "최소 체류시간 확보 불가",
  "destination_unreachable": "고정 도착지 도달 시간 부족",
  "lower_bound": "남은 일정으로 방문 불가",
  "unknown": "시간 내 방문 불가",
}


def search_optimal_route(
  trip: TripInput,
  candidates: Sequence[CandidatePlace],
  resolved_hours: dict[str, ResolvedOperatingHours],
  travel_matrix: TravelTimeMatrix,
  evaluation: CourseEvaluationInfo,
  *,
  config: CourseOptimizerConfig,
) -> RouteSearchResult:
  """k(방문 수) 우선순위로 실행 가능한 경로를 탐색하고 최고 점수 경로를 반환한다."""
  candidate_map = {candidate.place_id: candidate for candidate in candidates}
  categories_by_place_id = {
    candidate.place_id: candidate.category for candidate in candidates
  }
  durations = travel_matrix.durations_minutes
  all_place_ids = {candidate.place_id for candidate in candidates}
  total_candidates = len(candidates)

  failed_k_prune_logs: dict[int, dict[str, dict[str, int]]] = {}

  for target_k in range(total_candidates, config.min_visit_count - 1, -1):
    best_route, evaluated_count, candidate_count, prune_log = _search_at_visit_count(
      target_k,
      trip,
      candidate_map,
      resolved_hours,
      durations,
      evaluation,
      categories_by_place_id,
      config=config,
    )
    if best_route is None:
      failed_k_prune_logs[target_k] = prune_log
      continue

    free_time_minutes = calculate_free_time_minutes(trip, best_route.stops, durations)
    visited_ids = {stop.place_id for stop in best_route.stops}
    excluded_places = sorted(all_place_ids - visited_ids)
    exclusion_reason: dict[str, str] = {}
    if excluded_places and failed_k_prune_logs:
      source_k = max(failed_k_prune_logs)
      exclusion_reason = build_exclusion_reasons(
        excluded_places,
        failed_k_prune_logs[source_k],
      )

    return RouteSearchResult(
      selected_route=best_route,
      target_visit_count=target_k,
      evaluated_route_count=evaluated_count,
      candidate_route_count=candidate_count,
      free_time_minutes=free_time_minutes,
      excluded_places=excluded_places,
      exclusion_reason=exclusion_reason,
    )

  raise NoFeasibleRouteError("no feasible route found")


def _search_at_visit_count(
  target_k: int,
  trip: TripInput,
  candidate_map: dict[str, CandidatePlace],
  resolved_hours: dict[str, ResolvedOperatingHours],
  durations: dict[str, int],
  evaluation: CourseEvaluationInfo,
  categories_by_place_id: dict[str, str],
  *,
  config: CourseOptimizerConfig,
) -> tuple[ScoredRoute | None, int, int, dict[str, dict[str, int]]]:
  """정확히 target_k곳을 방문하는 실행 가능한 경로만 탐색한다."""
  prune_log: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
  best_route: ScoredRoute | None = None
  evaluated_count = 0
  candidate_count = 0

  def record_prune(place_id: str, reason: str) -> None:
    prune_log[place_id][reason] += 1

  def lower_bound_minutes(
    current_node: str,
    remaining_ids: set[str],
    places_needed: int,
  ) -> int:
    if places_needed <= 0:
      if trip.fixed_destination is not None:
        dest_key = f"{current_node}|{DESTINATION_NODE_ID}"
        if dest_key in durations:
          return durations[dest_key]
      return 0

    if places_needed > len(remaining_ids):
      return 10**9

    min_travel = min(
      durations[f"{current_node}|{place_id}"] for place_id in remaining_ids
    )
    min_stays = sorted(
      get_min_stay_minutes(candidate_map[place_id].category)
      for place_id in remaining_ids
    )[:places_needed]
    tail = 0
    if trip.fixed_destination is not None:
      tail = min(
        durations[f"{place_id}|{DESTINATION_NODE_ID}"] for place_id in remaining_ids
      )
    return min_travel + sum(min_stays) + tail

  def dfs(
    current_time: datetime,
    current_node: str,
    visited: list[str],
    remaining_ids: set[str],
  ) -> None:
    nonlocal best_route, evaluated_count, candidate_count

    places_needed = target_k - len(visited)

    if trip.fixed_destination is not None and places_needed == 0:
      dest_key = f"{current_node}|{DESTINATION_NODE_ID}"
      if dest_key in durations:
        travel_to_dest = durations[dest_key]
        if current_time + timedelta(minutes=travel_to_dest) > trip.end_time:
          return

    if len(visited) == target_k:
      candidate_count += 1
      stops = _build_stops(trip, visited, candidate_map, resolved_hours, durations)
      if stops is not None:
        evaluated_count += 1
        scored = build_scored_route(
          stops,
          trip,
          evaluation,
          durations,
          categories_by_place_id,
          config=config,
        )
        if best_route is None or scored.score.total_score > best_route.score.total_score:
          best_route = scored
      return

    if not remaining_ids or places_needed > len(remaining_ids):
      return

    if current_time + timedelta(
      minutes=lower_bound_minutes(current_node, remaining_ids, places_needed)
    ) > trip.end_time:
      for place_id in remaining_ids:
        record_prune(place_id, "lower_bound")
      return

    for place_id in sorted(remaining_ids):
      candidate = candidate_map[place_id]
      hours = resolved_hours[place_id]
      travel_minutes = durations[f"{current_node}|{place_id}"]
      arrival_time = current_time + timedelta(minutes=travel_minutes)
      if arrival_time > trip.end_time:
        record_prune(place_id, "time_exceeded")
        continue
      if not is_open_at(arrival_time, hours):
        record_prune(place_id, "closed_hours")
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
        record_prune(place_id, "insufficient_stay")
        continue

      departure_time = arrival_time + timedelta(minutes=actual_stay)
      if departure_time > trip.end_time:
        record_prune(place_id, "time_exceeded")
        continue

      next_remaining = set(remaining_ids)
      next_remaining.remove(place_id)
      dfs(
        departure_time,
        place_id,
        visited + [place_id],
        next_remaining,
      )

  dfs(
    trip.start_time,
    ORIGIN_NODE_ID,
    [],
    {candidate.place_id for candidate in candidate_map.values()},
  )

  return best_route, evaluated_count, candidate_count, prune_log


def calculate_free_time_minutes(
  trip: TripInput,
  stops: Sequence[VisitStop],
  durations: dict[str, int],
) -> int:
  """마지막 방문 종료 후 여행 종료 시각까지 남는 자유 시간(분)을 계산한다."""
  if not stops:
    return max(0, int((trip.end_time - trip.start_time).total_seconds() // 60))

  end_of_route = stops[-1].departure_time
  if trip.fixed_destination is not None:
    dest_key = f"{stops[-1].place_id}|{DESTINATION_NODE_ID}"
    if dest_key in durations:
      end_of_route += timedelta(minutes=durations[dest_key])

  free_minutes = int((trip.end_time - end_of_route).total_seconds() // 60)
  return max(0, free_minutes)


def build_exclusion_reasons(
  excluded_places: Sequence[str],
  prune_log: dict[str, dict[str, int]],
) -> dict[str, str]:
  """가지치기 로그에서 제외 장소별 사유를 추출한다."""
  reasons: dict[str, str] = {}
  for place_id in excluded_places:
    place_stats = prune_log.get(place_id)
    if not place_stats:
      reasons[place_id] = PRUNE_REASON_MESSAGES["unknown"]
      continue

    best_reason = max(place_stats, key=lambda reason: place_stats[reason])
    reasons[place_id] = PRUNE_REASON_MESSAGES.get(
      best_reason,
      PRUNE_REASON_MESSAGES["unknown"],
    )
  return reasons


def _build_stops(
  trip: TripInput,
  visited_place_ids: list[str],
  candidate_map: dict[str, CandidatePlace],
  resolved_hours: dict[str, ResolvedOperatingHours],
  durations: dict[str, int],
) -> list[VisitStop] | None:
  stops: list[VisitStop] = []
  current_time = trip.start_time
  current_node = ORIGIN_NODE_ID

  for place_id in visited_place_ids:
    candidate = candidate_map[place_id]
    hours = resolved_hours[place_id]
    travel_minutes = durations[f"{current_node}|{place_id}"]
    arrival_time = current_time + timedelta(minutes=travel_minutes)
    default_stay = get_default_stay_minutes(candidate.category)
    min_stay = get_min_stay_minutes(candidate.category)
    actual_stay = calculate_actual_stay_minutes(
      default_stay,
      min_stay,
      arrival_time,
      hours,
    )
    if actual_stay is None:
      return None
    departure_time = arrival_time + timedelta(minutes=actual_stay)
    stops.append(
      VisitStop(
        place_id=place_id,
        arrival_time=arrival_time,
        visit_start_time=arrival_time,
        departure_time=departure_time,
        actual_stay_minutes=actual_stay,
      )
    )
    current_time = departure_time
    current_node = place_id

  if trip.fixed_destination is not None:
    travel_to_dest = durations[f"{current_node}|{DESTINATION_NODE_ID}"]
    if current_time + timedelta(minutes=travel_to_dest) > trip.end_time:
      return None

  return stops
