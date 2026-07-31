"""semantic_vector_sync 연결 계층 테스트."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from pipeline.semantic_vector_sync import (
  analyze_saved_places,
  build_semantic_inputs,
  load_places_for_semantic_backfill,
  run_semantic_vector_sync,
  summarize_saved_places_for_semantic,
)
from semantic_vector.models import BatchAnalysisFailure, BatchAnalysisResult


@pytest.fixture
def saved_places() -> list[dict]:
  return [
    {
      "id": 1,
      "content_id": "1001",
      "name": "월영교",
      "category": "관광지",
      "main_image_url": "https://example.com/1.jpg",
    },
    {
      "id": 2,
      "content_id": "1002",
      "name": "이미지 없음",
      "category": "식당",
      "main_image_url": None,
    },
  ]


def test_build_semantic_inputs_skips_places_without_image(saved_places: list[dict]) -> None:
  inputs = build_semantic_inputs(saved_places)

  assert len(inputs) == 1
  assert inputs[0].place_id == "1"


def test_summarize_saved_places_for_semantic(saved_places: list[dict]) -> None:
  summary = summarize_saved_places_for_semantic(saved_places)

  assert summary == {
    "saved_count": 2,
    "semantic_target_count": 1,
    "skipped_no_image_count": 1,
  }


@pytest.mark.asyncio
async def test_analyze_saved_places_calls_analyze_places(saved_places: list[dict]) -> None:
  expected = BatchAnalysisResult(
    total_count=1,
    success_count=1,
    failed_count=0,
    results=[],
    failures=[],
  )

  with patch(
    "pipeline.semantic_vector_sync.analyze_places",
    new=AsyncMock(return_value=expected),
  ) as analyze_mock:
    result = await analyze_saved_places(saved_places)

  analyze_mock.assert_awaited_once()
  assert len(analyze_mock.await_args.args[0]) == 1
  assert result.success_count == 1


@pytest.mark.asyncio
async def test_analyze_saved_places_returns_empty_for_no_targets() -> None:
  result = await analyze_saved_places(
    [{"id": 1, "name": "없음", "category": "식당", "main_image_url": None}]
  )

  assert result.total_count == 0
  assert result.success_count == 0


@pytest.mark.asyncio
async def test_run_semantic_vector_sync_does_not_raise_on_partial_failure(
  saved_places: list[dict],
) -> None:
  expected = BatchAnalysisResult(
    total_count=1,
    success_count=0,
    failed_count=1,
    results=[],
    failures=[
      BatchAnalysisFailure(
        place_id="1",
        error_type="VisionRetryableError",
        error_message="timeout",
      )
    ],
  )

  with patch(
    "pipeline.semantic_vector_sync.analyze_places",
    new=AsyncMock(return_value=expected),
  ):
    result = await run_semantic_vector_sync(saved_places)

  assert result.failed_count == 1


def test_load_places_for_semantic_backfill_applies_limit_and_place_id() -> None:
  rows = [
    (1, "1001", "월영교", "관광지", "https://example.com/1.jpg"),
    (2, "1002", "하회마을", "관광지", "https://example.com/2.jpg"),
  ]
  cursor = MagicMock()
  cursor.description = [
    ("id",), ("content_id",), ("name",), ("category",), ("main_image_url",),
  ]
  cursor.fetchall.return_value = rows[:1]

  connection = MagicMock()
  connection.cursor.return_value.__enter__.return_value = cursor

  with patch("pipeline.semantic_vector_sync.get_connection") as get_connection_mock:
    get_connection_mock.return_value.__enter__.return_value = connection
    places = load_places_for_semantic_backfill(limit=1, place_id="1")

  assert len(places) == 1
  assert places[0]["id"] == 1
  cursor.execute.assert_called_once()
