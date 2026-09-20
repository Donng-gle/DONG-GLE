"""재시도 유틸리티."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar

T = TypeVar("T")


async def retry_async(
  operation: Callable[[], Awaitable[T]],
  *,
  max_retry_count: int,
  retryable_exceptions: tuple[type[Exception], ...],
  base_delay_seconds: float = 1.0,
) -> T:
  """지수 백오프로 비동기 작업을 재시도한다."""
  delay = base_delay_seconds
  last_error: Exception | None = None

  for attempt in range(max_retry_count):
    try:
      return await operation()
    except retryable_exceptions as error:
      last_error = error
      if attempt >= max_retry_count - 1:
        raise
      await asyncio.sleep(delay)
      delay *= 2

  assert last_error is not None
  raise last_error
