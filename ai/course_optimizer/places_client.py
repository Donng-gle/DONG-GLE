"""Google Places API 호출."""

from __future__ import annotations

import math
from collections.abc import Awaitable, Callable
from datetime import datetime, time
from typing import TypeVar

import httpx

from course_optimizer.config import CourseOptimizerConfig
from course_optimizer.exceptions import PlacesApiError
from course_optimizer.models import CandidatePlace, RawOperatingHours
from course_optimizer.operating_hours import python_weekday_to_place_day
from course_optimizer.place_hours_client import fetch_hours_for_visit_day
from semantic_vector.retry import retry_async

T = TypeVar("T")

_RETRYABLE_HTTP_EXCEPTIONS = (httpx.TimeoutException, httpx.HTTPStatusError)


async def _call_with_retry(
  operation: Callable[[], Awaitable[T]],
  *,
  config: CourseOptimizerConfig,
) -> T:
  """일시적 HTTP 오류는 재시도하고, 소진 시 PlacesApiError로 변환한다."""
  try:
    return await retry_async(
      operation,
      max_retry_count=config.max_retry_count,
      retryable_exceptions=_RETRYABLE_HTTP_EXCEPTIONS,
    )
  except httpx.HTTPStatusError as error:
    raise PlacesApiError(str(error)) from error
  except httpx.TimeoutException as error:
    raise PlacesApiError(str(error)) from error


def _parse_time(value: str) -> time:
  hour = int(value[:2])
  minute = int(value[2:4])
  return time(hour, minute)


def _raw_hours_from_periods(
  periods: list[dict],
  visit_time: datetime,
) -> RawOperatingHours:
  """Google Places periods에서 방문 요일에 해당하는 운영시간을 고른다."""
  if not periods:
    return RawOperatingHours(is_always_open=True)

  target_day = python_weekday_to_place_day(visit_time.weekday())
  day_periods = [
    period
    for period in periods
    if (period.get("open") or {}).get("day") == target_day
  ]

  if not day_periods:
    return RawOperatingHours(is_closed=True)

  open_times: list[time] = []
  close_times: list[time] = []
  for period in day_periods:
    open_info = period.get("open") or {}
    close_info = period.get("close")
    if not open_info.get("time"):
      continue
    if not close_info:
      return RawOperatingHours(is_always_open=True)
    open_times.append(_parse_time(str(open_info["time"]).zfill(4)))
    close_times.append(_parse_time(str(close_info["time"]).zfill(4)))

  if not open_times or not close_times:
    return RawOperatingHours(is_always_open=True)

  return RawOperatingHours(
    open_time=min(open_times),
    close_time=max(close_times),
    is_always_open=False,
  )


async def fetch_operating_hours(
  place_id: str,
  *,
  candidate: CandidatePlace,
  visit_time: datetime,
  config: CourseOptimizerConfig,
) -> RawOperatingHours | None:
  """방문 요일 기준 운영시간을 조회한다.

  1) DB place_hours (요일별 행)
  2) 없으면 Google Places periods를 요일 맞춰 파싱
  """
  db_hours = fetch_hours_for_visit_day(place_id, visit_time, config=config)
  if db_hours is not None:
    return db_hours

  url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
  params = {
    "location": f"{candidate.latitude},{candidate.longitude}",
    "radius": 300,
    "keyword": candidate.name or place_id,
    "language": "ko",
    "key": config.google_maps_api_key,
  }

  async def _call_nearby() -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
      response = await client.get(url, params=params)
      response.raise_for_status()
      return response.json()

  payload = await _call_with_retry(_call_nearby, config=config)

  status = payload.get("status")
  if status not in ("OK", "ZERO_RESULTS"):
    raise PlacesApiError(f"Google Places API error: {status}")

  results = payload.get("results", [])
  if not results:
    return None

  best = min(
    results,
    key=lambda item: _distance_m(
      candidate.latitude,
      candidate.longitude,
      item.get("geometry", {}).get("location", {}).get("lat", 0.0),
      item.get("geometry", {}).get("location", {}).get("lng", 0.0),
    ),
  )
  google_place_id = best.get("place_id")
  if not google_place_id:
    return None

  return await _fetch_place_details(
    google_place_id,
    visit_time=visit_time,
    config=config,
  )


async def fetch_business_status(
  candidate: CandidatePlace,
  *,
  config: CourseOptimizerConfig,
) -> bool:
  """장소 영업 여부를 조회한다.

  Google place_id를 찾지 못하면(매칭 실패) 정보가 없는 것으로 보고 True를 반환한다.
  API status가 OK가 아니면 PlacesApiError를 던진다.
  """
  url = "https://maps.googleapis.com/maps/api/place/details/json"
  params = {
    "place_id": await _resolve_google_place_id(candidate, config=config),
    "fields": "business_status",
    "language": "ko",
    "key": config.google_maps_api_key,
  }
  if params["place_id"] is None:
    return True

  async def _call_details() -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
      response = await client.get(url, params=params)
      response.raise_for_status()
      return response.json()

  payload = await _call_with_retry(_call_details, config=config)

  status = payload.get("status")
  if status != "OK":
    raise PlacesApiError(f"Google Places API error: {status}")
  business_status = payload.get("result", {}).get("business_status", "OPERATIONAL")
  return business_status == "OPERATIONAL"


async def _resolve_google_place_id(
  candidate: CandidatePlace,
  *,
  config: CourseOptimizerConfig,
) -> str | None:
  url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
  params = {
    "location": f"{candidate.latitude},{candidate.longitude}",
    "radius": 300,
    "keyword": candidate.name or candidate.place_id,
    "language": "ko",
    "key": config.google_maps_api_key,
  }

  async def _call_nearby() -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
      response = await client.get(url, params=params)
      response.raise_for_status()
      return response.json()

  payload = await _call_with_retry(_call_nearby, config=config)
  if payload.get("status") not in ("OK", "ZERO_RESULTS"):
    raise PlacesApiError(f"Google Places API error: {payload.get('status')}")
  results = payload.get("results", [])
  if not results:
    return None
  best = min(
    results,
    key=lambda item: _distance_m(
      candidate.latitude,
      candidate.longitude,
      item.get("geometry", {}).get("location", {}).get("lat", 0.0),
      item.get("geometry", {}).get("location", {}).get("lng", 0.0),
    ),
  )
  return best.get("place_id")


async def _fetch_place_details(
  google_place_id: str,
  *,
  visit_time: datetime,
  config: CourseOptimizerConfig,
) -> RawOperatingHours | None:
  url = "https://maps.googleapis.com/maps/api/place/details/json"
  params = {
    "place_id": google_place_id,
    "fields": "opening_hours,business_status",
    "language": "ko",
    "key": config.google_maps_api_key,
  }

  async def _call() -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
      response = await client.get(url, params=params)
      response.raise_for_status()
      return response.json()

  payload = await _call_with_retry(_call, config=config)
  if payload.get("status") != "OK":
    return None

  result = payload.get("result", {})
  if result.get("business_status") == "CLOSED_PERMANENTLY":
    return RawOperatingHours(is_closed=True)

  opening_hours = result.get("opening_hours", {})
  if opening_hours.get("open_now") is None and not opening_hours.get("periods"):
    return None

  periods = opening_hours.get("periods") or []
  return _raw_hours_from_periods(periods, visit_time)


def _distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
  radius_m = 6_371_000
  phi1, phi2 = math.radians(lat1), math.radians(lat2)
  d_phi = math.radians(lat2 - lat1)
  d_lambda = math.radians(lng2 - lng1)
  a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
  return 2 * radius_m * math.asin(math.sqrt(a))
