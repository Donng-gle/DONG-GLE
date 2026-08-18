"""Google Routes API 호출."""

from __future__ import annotations

import math

import httpx

from course_optimizer.config import CourseOptimizerConfig
from course_optimizer.constants import DESTINATION_NODE_ID, ORIGIN_NODE_ID
from course_optimizer.exceptions import RoutesApiError
from course_optimizer.models import LatLng, TravelTimeMatrix, TripInput
from semantic_vector.retry import retry_async

TRANSPORT_MODE_MAP = {
  "walk": "WALK",
  "transit": "TRANSIT",
  "car": "DRIVE",
}


def _distance_minutes(
  origin: LatLng,
  destination: LatLng,
  transport_mode: str,
) -> int:
  """API 실패 시 사용할 거리 기반 추정 이동시간(분)."""
  speed_kmh = {"walk": 4.5, "transit": 25.0, "car": 35.0}[transport_mode]
  radius_m = 6_371_000
  phi1, phi2 = math.radians(origin.latitude), math.radians(destination.latitude)
  d_phi = math.radians(destination.latitude - origin.latitude)
  d_lambda = math.radians(destination.longitude - origin.longitude)
  a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
  distance_km = 2 * radius_m * math.asin(math.sqrt(a)) / 1000
  return max(1, int((distance_km / speed_kmh) * 60))


def _node_locations(trip: TripInput) -> dict[str, LatLng]:
  locations = {ORIGIN_NODE_ID: trip.origin}
  for candidate in trip.candidates:
    locations[candidate.place_id] = LatLng(
      latitude=candidate.latitude,
      longitude=candidate.longitude,
    )
  if trip.fixed_destination is not None:
    locations[DESTINATION_NODE_ID] = trip.fixed_destination
  return locations


async def build_travel_time_matrix(
  trip: TripInput,
  *,
  config: CourseOptimizerConfig,
) -> TravelTimeMatrix:
  """출발지-후보-고정도착지 간 이동시간 행렬을 생성한다."""
  locations = _node_locations(trip)
  node_ids = list(locations.keys())
  durations: dict[str, int] = {}

  for from_id in node_ids:
    for to_id in node_ids:
      if from_id == to_id:
        continue
      durations[f"{from_id}|{to_id}"] = await _fetch_route_minutes(
        locations[from_id],
        locations[to_id],
        transport_mode=trip.transport_mode,
        config=config,
      )

  return TravelTimeMatrix(durations_minutes=durations)


async def _fetch_route_minutes(
  origin: LatLng,
  destination: LatLng,
  *,
  transport_mode: str,
  config: CourseOptimizerConfig,
) -> int:
  url = "https://routes.googleapis.com/directions/v2:computeRoutes"
  headers = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": config.google_maps_api_key,
    "X-Goog-FieldMask": "routes.duration",
  }
  body = {
    "origin": {
      "location": {
        "latLng": {
          "latitude": origin.latitude,
          "longitude": origin.longitude,
        }
      }
    },
    "destination": {
      "location": {
        "latLng": {
          "latitude": destination.latitude,
          "longitude": destination.longitude,
        }
      }
    },
    "travelMode": TRANSPORT_MODE_MAP[transport_mode],
  }

  async def _call() -> int:
    async with httpx.AsyncClient(timeout=30.0) as client:
      response = await client.post(url, headers=headers, json=body)
      if response.status_code == 401:
        raise RoutesApiError(response.text)
      if response.status_code >= 500 or response.status_code == 429:
        response.raise_for_status()
      if response.status_code >= 400:
        return _distance_minutes(origin, destination, transport_mode)
      payload = response.json()
      routes = payload.get("routes", [])
      if not routes:
        return _distance_minutes(origin, destination, transport_mode)
      duration = routes[0].get("duration", "0s")
      seconds = int(str(duration).rstrip("s"))
      return max(1, seconds // 60)

  try:
    return await retry_async(
      _call,
      max_retry_count=config.max_retry_count,
      retryable_exceptions=(httpx.TimeoutException, httpx.HTTPStatusError),
    )
  except httpx.HTTPStatusError as error:
    if error.response.status_code == 401:
      raise RoutesApiError(str(error)) from error
    return _distance_minutes(origin, destination, transport_mode)
  except httpx.TimeoutException:
    return _distance_minutes(origin, destination, transport_mode)
