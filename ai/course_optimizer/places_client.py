"""Google Places API 호출."""

from __future__ import annotations

import math
from datetime import time

import httpx

from course_optimizer.config import CourseOptimizerConfig
from course_optimizer.exceptions import PlacesApiError
from course_optimizer.models import CandidatePlace, RawOperatingHours
from semantic_vector.retry import retry_async


def _parse_time(value: str) -> time:
  hour = int(value[:2])
  minute = int(value[2:4])
  return time(hour, minute)


async def fetch_operating_hours(
  place_id: str,
  *,
  candidate: CandidatePlace,
  config: CourseOptimizerConfig,
) -> RawOperatingHours | None:
  """Google Places API로 운영시간을 조회한다."""
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

  try:
    payload = await retry_async(
      _call_nearby,
      max_retry_count=config.max_retry_count,
      retryable_exceptions=(httpx.TimeoutException, httpx.HTTPStatusError),
    )
  except httpx.HTTPStatusError as error:
    if error.response.status_code == 401:
      raise PlacesApiError(str(error)) from error
    raise PlacesApiError(str(error)) from error
  except httpx.TimeoutException as error:
    raise PlacesApiError(str(error)) from error

  status = payload.get("status")
  if status not in ("OK", "ZERO_RESULTS"):
    if status in ("REQUEST_DENIED", "INVALID_REQUEST"):
      raise PlacesApiError(f"Google Places API error: {status}")
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

  return await _fetch_place_details(google_place_id, config=config)


async def fetch_business_status(
  candidate: CandidatePlace,
  *,
  config: CourseOptimizerConfig,
) -> bool:
  """장소 영업 여부를 조회한다. 정보가 없으면 영업 중으로 간주한다."""
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

  try:
    payload = await retry_async(
      _call_details,
      max_retry_count=config.max_retry_count,
      retryable_exceptions=(httpx.TimeoutException, httpx.HTTPStatusError),
    )
  except (httpx.HTTPStatusError, httpx.TimeoutException) as error:
    raise PlacesApiError(str(error)) from error

  if payload.get("status") != "OK":
    return True
  status = payload.get("result", {}).get("business_status", "OPERATIONAL")
  return status == "OPERATIONAL"


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
  async with httpx.AsyncClient(timeout=30.0) as client:
    response = await client.get(url, params=params)
    response.raise_for_status()
    payload = response.json()
  if payload.get("status") not in ("OK", "ZERO_RESULTS"):
    return None
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

  payload = await retry_async(
    _call,
    max_retry_count=config.max_retry_count,
    retryable_exceptions=(httpx.TimeoutException, httpx.HTTPStatusError),
  )
  if payload.get("status") != "OK":
    return None

  result = payload.get("result", {})
  if result.get("business_status") == "CLOSED_PERMANENTLY":
    return RawOperatingHours(is_closed=True)

  opening_hours = result.get("opening_hours", {})
  if opening_hours.get("open_now") is None and not opening_hours.get("periods"):
    return None

  periods = opening_hours.get("periods") or []
  if not periods:
    return RawOperatingHours(is_always_open=True)

  first_period = periods[0]
  open_info = first_period.get("open")
  close_info = first_period.get("close")
  if not open_info or not close_info:
    return RawOperatingHours(is_always_open=True)

  return RawOperatingHours(
    open_time=_parse_time(str(open_info["time"]).zfill(4)),
    close_time=_parse_time(str(close_info["time"]).zfill(4)),
    is_always_open=False,
  )


def _distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
  radius_m = 6_371_000
  phi1, phi2 = math.radians(lat1), math.radians(lat2)
  d_phi = math.radians(lat2 - lat1)
  d_lambda = math.radians(lng2 - lng1)
  a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
  return 2 * radius_m * math.asin(math.sqrt(a))
