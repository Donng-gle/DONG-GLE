"""operating_hours 테스트."""

from __future__ import annotations

from datetime import datetime, time

from course_optimizer.models import RawOperatingHours, ResolvedOperatingHours
from course_optimizer.operating_hours import (
  calculate_actual_stay_minutes,
  get_time_slot,
  python_weekday_to_place_day,
  resolve_operating_hours,
)
from course_optimizer.places_client import _raw_hours_from_periods


def test_resolve_operating_hours_uses_raw() -> None:
  raw = RawOperatingHours(open_time=time(9, 0), close_time=time(18, 0))
  resolved = resolve_operating_hours("관광지", raw)
  assert resolved.open_time == time(9, 0)
  assert resolved.close_time == time(18, 0)
  assert resolved.is_always_open is False


def test_resolve_operating_hours_fallback() -> None:
  resolved = resolve_operating_hours("식당", None)
  assert resolved.open_time == time(11, 0)
  assert resolved.close_time == time(21, 0)


def test_resolve_operating_hours_always_open() -> None:
  resolved = resolve_operating_hours("관광지", None)
  assert resolved.is_always_open is True


def test_resolve_operating_hours_closed_day_does_not_fallback() -> None:
  resolved = resolve_operating_hours("식당", RawOperatingHours(is_closed=True))
  assert resolved.is_always_open is False
  assert resolved.open_time == time(0, 0)
  assert resolved.close_time == time(0, 0)


def test_calculate_actual_stay_minutes_default() -> None:
  visit_start = datetime(2026, 8, 1, 10, 0)
  hours = ResolvedOperatingHours(is_always_open=True)
  assert calculate_actual_stay_minutes(60, 30, visit_start, hours) == 60


def test_calculate_actual_stay_minutes_limited_by_closing() -> None:
  visit_start = datetime(2026, 8, 1, 17, 30)
  hours = ResolvedOperatingHours(
    open_time=time(9, 0),
    close_time=time(18, 0),
    is_always_open=False,
  )
  assert calculate_actual_stay_minutes(60, 30, visit_start, hours) == 30


def test_calculate_actual_stay_minutes_below_min_returns_none() -> None:
  visit_start = datetime(2026, 8, 1, 17, 50)
  hours = ResolvedOperatingHours(
    open_time=time(9, 0),
    close_time=time(18, 0),
    is_always_open=False,
  )
  assert calculate_actual_stay_minutes(60, 30, visit_start, hours) is None


def test_get_time_slot_boundary() -> None:
  assert get_time_slot(datetime(2026, 8, 1, 10, 30)) == "morning"
  assert get_time_slot(datetime(2026, 8, 1, 12, 0)) == "lunch"
  assert get_time_slot(datetime(2026, 8, 1, 23, 0)) == "night"
  assert get_time_slot(datetime(2026, 8, 1, 3, 0)) == "night"


def test_resolve_operating_hours_indoor_profile() -> None:
  resolved = resolve_operating_hours("attraction_indoor", None)
  assert resolved.open_time == time(9, 0)
  assert resolved.close_time == time(18, 0)
  assert resolved.is_always_open is False


def test_python_weekday_to_place_day() -> None:
  # 2026-08-02 = Sunday
  assert python_weekday_to_place_day(datetime(2026, 8, 2).weekday()) == 0
  # 2026-08-03 = Monday
  assert python_weekday_to_place_day(datetime(2026, 8, 3).weekday()) == 1


def test_raw_hours_from_periods_selects_visit_weekday() -> None:
  periods = [
    {"open": {"day": 0, "time": "1000"}, "close": {"day": 0, "time": "1700"}},
    {"open": {"day": 1, "time": "0900"}, "close": {"day": 1, "time": "1800"}},
    {"open": {"day": 3, "time": "1100"}, "close": {"day": 3, "time": "1600"}},
  ]
  # Monday 2026-08-03 -> place day 1
  raw = _raw_hours_from_periods(periods, datetime(2026, 8, 3, 12, 0))
  assert raw.open_time == time(9, 0)
  assert raw.close_time == time(18, 0)
  assert raw.is_closed is False


def test_raw_hours_from_periods_closed_when_weekday_missing() -> None:
  periods = [
    {"open": {"day": 0, "time": "1000"}, "close": {"day": 0, "time": "1700"}},
  ]
  # Tuesday 2026-08-04 -> place day 2
  raw = _raw_hours_from_periods(periods, datetime(2026, 8, 4, 12, 0))
  assert raw.is_closed is True
