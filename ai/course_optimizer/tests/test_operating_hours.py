"""operating_hours 테스트."""

from __future__ import annotations

from datetime import datetime, time

from course_optimizer.models import RawOperatingHours, ResolvedOperatingHours
from course_optimizer.operating_hours import (
  calculate_actual_stay_minutes,
  get_time_slot,
  resolve_operating_hours,
)


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
