"""운영시간 fallback 및 체류시간 계산."""

from __future__ import annotations

from datetime import datetime, time, timedelta

from course_optimizer.constants import (
  CATEGORY_PROFILE_MAP,
  DEFAULT_STAY_MINUTES,
  MIN_STAY_MINUTES,
  OPERATING_HOURS_FALLBACK,
  TIME_SLOTS,
)
from course_optimizer.models import RawOperatingHours, ResolvedOperatingHours


def resolve_category_profile(category: str) -> str:
  """한글/영문 category를 체류시간 프로필 키로 변환한다."""
  if category in DEFAULT_STAY_MINUTES:
    return category
  return CATEGORY_PROFILE_MAP.get(category, "attraction_outdoor")


def python_weekday_to_place_day(python_weekday: int) -> int:
  """Python weekday(월=0)를 place_hours/Google day(일=0)로 변환한다."""
  return (python_weekday + 1) % 7


def resolve_operating_hours(
  category: str,
  raw_hours: RawOperatingHours | None,
) -> ResolvedOperatingHours:
  """category fallback을 적용해 운영시간을 해석한다."""
  if raw_hours is not None and raw_hours.is_closed:
    # 해당 요일 휴무. category fallback으로 열어주지 않는다.
    return ResolvedOperatingHours(
      open_time=time(0, 0),
      close_time=time(0, 0),
      is_always_open=False,
    )

  if raw_hours is not None:
    if raw_hours.is_always_open:
      return ResolvedOperatingHours(is_always_open=True)
    if raw_hours.open_time and raw_hours.close_time:
      return ResolvedOperatingHours(
        open_time=raw_hours.open_time,
        close_time=raw_hours.close_time,
        is_always_open=False,
      )

  profile = resolve_category_profile(category)
  fallback = OPERATING_HOURS_FALLBACK.get(profile)
  if fallback is None:
    return ResolvedOperatingHours(is_always_open=True)

  open_time, close_time = fallback
  return ResolvedOperatingHours(
    open_time=open_time,
    close_time=close_time,
    is_always_open=False,
  )


def get_default_stay_minutes(category: str) -> int:
  """category별 기본 체류시간(분)을 반환한다."""
  profile = resolve_category_profile(category)
  return DEFAULT_STAY_MINUTES[profile]


def get_min_stay_minutes(category: str) -> int:
  """category별 최소 체류시간(분)을 반환한다."""
  profile = resolve_category_profile(category)
  return MIN_STAY_MINUTES[profile]


def get_time_slot(visit_start: datetime) -> str:
  """방문 시작 시각이 속한 시간대 키를 반환한다."""
  current = visit_start.time()
  for slot, (start, end) in TIME_SLOTS.items():
    if start <= end:
      if start <= current < end:
        return slot
    elif current >= start or current < end:
      return slot
  return "night"


def _closing_datetime(visit_start: datetime, close_time: time) -> datetime:
  closing = visit_start.replace(
    hour=close_time.hour,
    minute=close_time.minute,
    second=0,
    microsecond=0,
  )
  if closing <= visit_start:
    closing += timedelta(days=1)
  return closing


def is_open_at(visit_start: datetime, hours: ResolvedOperatingHours) -> bool:
  """방문 시작 시각에 운영 중인지 확인한다."""
  if hours.is_always_open:
    return True
  if hours.open_time is None or hours.close_time is None:
    return True
  current = visit_start.time()
  if hours.open_time <= hours.close_time:
    return hours.open_time <= current < hours.close_time
  return current >= hours.open_time or current < hours.close_time


def calculate_actual_stay_minutes(
  default_stay: int,
  min_stay: int,
  visit_start: datetime,
  hours: ResolvedOperatingHours,
) -> int | None:
  """실제 체류 가능 시간(분)을 계산한다. 최소 체류시간 미만이면 None."""
  if not is_open_at(visit_start, hours):
    return None

  if hours.is_always_open or hours.close_time is None:
    actual = default_stay
  else:
    closing = _closing_datetime(visit_start, hours.close_time)
    remaining = int((closing - visit_start).total_seconds() // 60)
    actual = min(default_stay, remaining)

  if actual < min_stay:
    return None
  return actual
