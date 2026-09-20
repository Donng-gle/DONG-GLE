"""semantic_vector_sync 연결 계층 테스트."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from pipeline.semantic_vector_sync import (
  analyze_saved_places,
  build_semantic_inputs,
  filter_pending_semantic_places,
  load_places_for_semantic_backfill,
  run_semantic_vector_sync,
  summarize_saved_places_for_semantic,
  sync_pending_semantic_vectors,
)
from semantic_vector.batch import BatchAnalysisWithDetailsResult
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
      "extra_image_urls": [
        "https://example.com/1-extra-1.jpg",
        "https://example.com/1-extra-2.jpg",
      ],
    },
    {
      "id": 2,
      "content_id": "1002",
      "name": "이미지 없음",
      "category": "식당",
      "main_image_url": None,
      "extra_image_urls": [],
    },
  ]


def test_build_semantic_inputs_uses_representative_and_extra_images(
  saved_places: list[dict],
) -> None:
  inputs = build_semantic_inputs(saved_places)

  assert len(inputs) == 1
  assert inputs[0].place_id == "1"
  assert inputs[0].image_url == "https://example.com/1.jpg"
  assert inputs[0].analysis_image_urls == [
    "https://example.com/1.jpg",
    "https://example.com/1-extra-1.jpg",
    "https://example.com/1-extra-2.jpg",
  ]


def test_summarize_saved_places_for_semantic(saved_places: list[dict]) -> None:
  with patch(
    "pipeline.semantic_vector_sync._fetch_analyzed_place_ids",
    return_value=set(),
  ):
    summary = summarize_saved_places_for_semantic(saved_places)

  assert summary == {
    "saved_count": 2,
    "semantic_target_count": 1,
    "already_analyzed_count": 0,
    "skipped_no_image_count": 1,
  }


def test_filter_pending_semantic_places_excludes_analyzed(saved_places: list[dict]) -> None:
  with patch(
    "pipeline.semantic_vector_sync._fetch_analyzed_place_ids",
    return_value={1},
  ):
    pending = filter_pending_semantic_places(saved_places)

  assert pending == []


@pytest.mark.asyncio
async def test_analyze_saved_places_calls_analyze_places_with_details(
  saved_places: list[dict],
) -> None:
  expected = BatchAnalysisWithDetailsResult(
    total_count=1,
    success_count=1,
    failed_count=0,
    results=[],
    failures=[],
  )

  with (
    patch(
      "pipeline.semantic_vector_sync.analyze_places_with_details",
      new=AsyncMock(return_value=expected),
    ) as analyze_mock,
    patch("pipeline.semantic_vector_sync.get_connection"),
  ):
    result = await analyze_saved_places(saved_places, persist_scores=False)

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

  with (
    patch(
      "pipeline.semantic_vector_sync.filter_pending_semantic_places",
      return_value=[saved_places[0]],
    ),
    patch(
      "pipeline.semantic_vector_sync.analyze_saved_places",
      new=AsyncMock(return_value=expected),
    ),
  ):
    result = await run_semantic_vector_sync(saved_places)

  assert result.failed_count == 1


@pytest.mark.asyncio
async def test_sync_pending_semantic_vectors_batches_unanalyzed_places(
  saved_places: list[dict],
) -> None:
  expected = BatchAnalysisResult(
    total_count=1,
    success_count=1,
    failed_count=0,
    results=[],
    failures=[],
  )

  with (
    patch(
      "pipeline.semantic_vector_sync.load_places_for_semantic_backfill",
      return_value=saved_places,
    ) as load_mock,
    patch(
      "pipeline.semantic_vector_sync.run_semantic_vector_sync",
      new=AsyncMock(return_value=expected),
    ) as sync_mock,
  ):
    result = await sync_pending_semantic_vectors(batch_size=1, limit=2)

  load_mock.assert_called_once()
  assert load_mock.call_args.kwargs["only_unanalyzed"] is True
  assert load_mock.call_args.kwargs["limit"] == 2
  assert sync_mock.await_count == 2
  assert result.success_count == 2


def test_load_places_for_semantic_backfill_applies_limit_and_place_id() -> None:
  rows = [
    (
      1,
      "1001",
      "월영교",
      "관광지",
      "https://example.com/1.jpg",
      ["https://example.com/1-extra.jpg"],
    ),
    (
      2,
      "1002",
      "하회마을",
      "관광지",
      "https://example.com/2.jpg",
      [],
    ),
  ]
  cursor = MagicMock()
  cursor.description = [
    ("id",),
    ("content_id",),
    ("name",),
    ("category",),
    ("main_image_url",),
    ("extra_image_urls",),
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
  sql = cursor.execute.call_args.args[0]
  assert "place_semantic_vector" in sql
