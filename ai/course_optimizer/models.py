"""입력, LLM 응답, 경로, 결과 모델."""

from __future__ import annotations

from datetime import datetime, time
from typing import Literal

from pydantic import BaseModel, Field

from semantic_vector.models import MajorScores


class LatLng(BaseModel):
  latitude: float
  longitude: float


class CandidatePlace(BaseModel):
  place_id: str
  category: str
  major_scores: MajorScores
  latitude: float
  longitude: float
  name: str | None = None
  is_open: bool = True


class TripInput(BaseModel):
  start_time: datetime
  end_time: datetime
  transport_mode: Literal["walk", "transit", "car"]
  origin: LatLng
  fixed_destination: LatLng | None = None
  candidates: list[CandidatePlace]


class TimeSuitability(BaseModel):
  morning: float
  lunch: float
  afternoon: float
  evening: float


class PlaceFeatures(BaseModel):
  activity_level: float
  rest_level: float


class CourseEvaluationInfo(BaseModel):
  time_suitability: dict[str, TimeSuitability]
  transition_scores: dict[str, dict[str, float]]
  place_features: dict[str, PlaceFeatures]


class RawOperatingHours(BaseModel):
  open_time: time | None = None
  close_time: time | None = None
  is_closed: bool = False
  is_always_open: bool = False


class ResolvedOperatingHours(BaseModel):
  open_time: time | None = None
  close_time: time | None = None
  is_always_open: bool = True


class TravelTimeMatrix(BaseModel):
  """노드 쌍별 이동시간(분). 키 형식: '{from_id}|{to_id}'."""

  durations_minutes: dict[str, int] = Field(default_factory=dict)

  def get_minutes(self, from_id: str, to_id: str) -> int:
    key = f"{from_id}|{to_id}"
    if key not in self.durations_minutes:
      raise KeyError(f"missing travel duration: {key}")
    return self.durations_minutes[key]


class VisitStop(BaseModel):
  place_id: str
  arrival_time: datetime
  visit_start_time: datetime
  departure_time: datetime
  actual_stay_minutes: int


class RouteScoreBreakdown(BaseModel):
  time_score: float
  transition_score: float
  balance_score: float
  experience_score: float
  total_travel_minutes: int
  travel_score: float
  total_score: float


class ScoredRoute(BaseModel):
  stops: list[VisitStop]
  score: RouteScoreBreakdown


class RouteSearchResult(BaseModel):
  selected_route: ScoredRoute
  target_visit_count: int
  evaluated_route_count: int
  candidate_route_count: int
  free_time_minutes: int = 0
  excluded_places: list[str] = Field(default_factory=list)
  exclusion_reason: dict[str, str] = Field(default_factory=dict)


class CourseOptimizationResult(BaseModel):
  selected_route: ScoredRoute
  candidate_route_count: int
  evaluated_route_count: int
  target_visit_count: int
  free_time_minutes: int = 0
  prompt_version: str
  model_name: str
  excluded_place_ids: list[str] = Field(default_factory=list)
  excluded_places: list[str] = Field(default_factory=list)
  exclusion_reason: dict[str, str] = Field(default_factory=dict)
  replaced_places: dict[str, str] = Field(default_factory=dict)
