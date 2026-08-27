"""DB place_hours 조회 (요일별 운영시간)."""

from __future__ import annotations

import logging
from datetime import datetime, time

import psycopg2

from course_optimizer.config import CourseOptimizerConfig
from course_optimizer.models import RawOperatingHours
from course_optimizer.operating_hours import python_weekday_to_place_day

logger = logging.getLogger(__name__)


def fetch_hours_for_visit_day(
  place_id: str,
  visit_time: datetime,
  *,
  config: CourseOptimizerConfig,
) -> RawOperatingHours | None:
  """place_hours에서 방문 요일의 운영시간을 조회한다.

  place_id가 숫자 DB id가 아니거나 DATABASE_URL이 없으면 None을 반환한다.
  해당 요일 행이 없으면 is_closed=True를 반환한다.
  """
  if not config.database_url:
    return None

  try:
    db_place_id = int(place_id)
  except ValueError:
    return None

  target_day = python_weekday_to_place_day(visit_time.weekday())

  try:
    with psycopg2.connect(config.database_url) as conn:
      with conn.cursor() as cur:
        cur.execute(
          """
          SELECT open_time, close_time, close_day
          FROM place_hours
          WHERE place_id = %s AND open_day = %s
          ORDER BY open_time
          """,
          (db_place_id, target_day),
        )
        rows = cur.fetchall()
  except Exception:
    logger.exception("place_hours lookup failed place_id=%s", place_id)
    return None

  if not rows:
    return RawOperatingHours(is_closed=True)

  # 상시개방: close_time NULL
  if all(close_time is None for _, close_time, _ in rows):
    return RawOperatingHours(is_always_open=True)

  open_times: list[time] = []
  close_times: list[time] = []
  for open_time, close_time, _close_day in rows:
    if open_time is None:
      continue
    open_times.append(open_time)
    if close_time is not None:
      close_times.append(close_time)

  if not open_times or not close_times:
    return RawOperatingHours(is_always_open=True)

  return RawOperatingHours(
    open_time=min(open_times),
    close_time=max(close_times),
    is_always_open=False,
  )
