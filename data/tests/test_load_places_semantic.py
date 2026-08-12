"""load_places Semantic Vector 연결 테스트."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from pipeline.load_places import main
from semantic_vector.models import BatchAnalysisResult


def _run_coro(coro):
  loop = asyncio.new_event_loop()
  try:
    return loop.run_until_complete(coro)
  finally:
    loop.close()


def test_main_runs_semantic_sync_after_db_save() -> None:
  saved_places = [
    {
      "id": 1,
      "content_id": "1001",
      "name": "월영교",
      "category": "관광지",
      "main_image_url": "https://example.com/1.jpg",
    }
  ]
  batch_result = BatchAnalysisResult(
    total_count=1,
    success_count=1,
    failed_count=0,
    results=[],
    failures=[],
  )

  with (
    patch("pipeline.load_places.load_raw", return_value=([], {}, {}, {}, {})),
    patch("pipeline.load_places.save_places_to_db", return_value=(saved_places, 0)),
    patch(
      "pipeline.load_places.summarize_saved_places_for_semantic",
      return_value={
        "saved_count": 1,
        "semantic_target_count": 1,
        "already_analyzed_count": 0,
        "skipped_no_image_count": 0,
      },
    ),
    patch(
      "pipeline.load_places.run_semantic_vector_sync",
      new=AsyncMock(return_value=batch_result),
    ) as sync_mock,
    patch("pipeline.load_places.asyncio.run", side_effect=_run_coro),
  ):
    main(skip_semantic=False)

  sync_mock.assert_awaited_once_with(saved_places)


def test_main_skips_semantic_sync_when_requested() -> None:
  with (
    patch("pipeline.load_places.load_raw", return_value=([], {}, {}, {}, {})),
    patch("pipeline.load_places.save_places_to_db", return_value=([], 0)),
    patch("pipeline.load_places.asyncio.run") as run_mock,
  ):
    main(skip_semantic=True)

  run_mock.assert_not_called()
