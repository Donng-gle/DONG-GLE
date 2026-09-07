"""log_emotion_sync 연결 계층 테스트."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from pipeline.log_emotion_sync import (
  analyze_visit_logs,
  build_visit_log_emotion_inputs,
  filter_pending_visit_logs,
  load_visit_logs_for_emotion_backfill,
  sync_pending_log_emotion_tags,
)
from semantic_vector.analyzer import PlaceAnalysisResult
from semantic_vector.models import (
  BatchAnalysisFailure,
  BatchAnalysisResult,
  DetailScores,
  MajorScores,
  SemanticVectorResult,
)


def _fake_place_analysis(visit_log_id: str) -> PlaceAnalysisResult:
  detail = DetailScores.model_validate({tag: 0.1 for tag in DetailScores.model_fields})
  major = MajorScores.model_validate({tag: 0.1 for tag in MajorScores.model_fields})
  result = SemanticVectorResult(
    place_id=visit_log_id,
    image_id=None,
    detail_scores=detail,
    major_scores=major,
    detail_vector=[0.1] * 35,
    major_vector=[0.1] * 7,
    summary=None,
    model_name="gpt-test",
    prompt_version="semantic-image-v4.1",
    tag_schema_version="v1",
    qdrant_point_id="unused",
  )
  return PlaceAnalysisResult(result=result, per_image_responses=[])


@pytest.fixture
def visit_logs() -> list[dict]:
  return [
    {
      "id": 1,
      "photo_urls": ["https://example.com/1-a.jpg", "https://example.com/1-b.jpg"],
    },
    {
      "id": 2,
      "photo_urls": [],
    },
  ]


def test_build_visit_log_emotion_inputs_uses_all_photos(visit_logs: list[dict]) -> None:
  inputs = build_visit_log_emotion_inputs(visit_logs, images_per_log=3)

  assert len(inputs) == 1
  assert inputs[0].place_id == "1"
  assert inputs[0].image_url == "https://example.com/1-a.jpg"
  assert inputs[0].analysis_image_urls == [
    "https://example.com/1-a.jpg",
    "https://example.com/1-b.jpg",
  ]


def test_build_visit_log_emotion_inputs_caps_by_images_per_log(visit_logs: list[dict]) -> None:
  inputs = build_visit_log_emotion_inputs(visit_logs, images_per_log=1)

  assert inputs[0].analysis_image_urls == ["https://example.com/1-a.jpg"]


def test_filter_pending_visit_logs_excludes_no_photo_and_analyzed(visit_logs: list[dict]) -> None:
  pending = filter_pending_visit_logs(visit_logs, analyzed_visit_log_ids=set())

  assert [log["id"] for log in pending] == [1]  # id=2는 사진 없어서 제외


def test_filter_pending_visit_logs_excludes_already_analyzed(visit_logs: list[dict]) -> None:
  pending = filter_pending_visit_logs(visit_logs, analyzed_visit_log_ids={1})

  assert pending == []


@pytest.mark.asyncio
async def test_analyze_visit_logs_calls_analyzer_with_persist_false(
  visit_logs: list[dict],
) -> None:
  fake_place_analysis = _fake_place_analysis("1")

  with (
    patch(
      "pipeline.log_emotion_sync.analyze_place_with_details",
      new=AsyncMock(return_value=fake_place_analysis),
    ) as analyze_mock,
    patch("pipeline.log_emotion_sync.get_connection"),
    patch("pipeline.log_emotion_sync.save_log_emotion_tags", return_value=1),
  ):
    result = await analyze_visit_logs(visit_logs)

  analyze_mock.assert_awaited_once()
  assert analyze_mock.await_args.kwargs["persist"] is False
  assert result.success_count == 1


@pytest.mark.asyncio
async def test_analyze_visit_logs_returns_empty_for_no_targets() -> None:
  result = await analyze_visit_logs([{"id": 1, "photo_urls": []}])

  assert result.total_count == 0
  assert result.success_count == 0


@pytest.mark.asyncio
async def test_analyze_visit_logs_partial_failure_does_not_raise(visit_logs: list[dict]) -> None:
  async def _analyze(item, **kwargs):
    raise ValueError("vision failed")

  with (
    patch("pipeline.log_emotion_sync.analyze_place_with_details", new=AsyncMock(side_effect=_analyze)),
  ):
    result = await analyze_visit_logs(visit_logs, persist_scores=False)

  assert result.success_count == 0
  assert result.failed_count == 1
  assert result.failures[0].place_id == "1"


@pytest.mark.asyncio
async def test_sync_pending_log_emotion_tags_batches(visit_logs: list[dict]) -> None:
  expected = BatchAnalysisResult(total_count=1, success_count=1, failed_count=0, results=[], failures=[])

  with (
    patch(
      "pipeline.log_emotion_sync.load_visit_logs_for_emotion_backfill",
      return_value=visit_logs,
    ) as load_mock,
    patch(
      "pipeline.log_emotion_sync.analyze_visit_logs",
      new=AsyncMock(return_value=expected),
    ) as analyze_mock,
  ):
    result = await sync_pending_log_emotion_tags(batch_size=1, limit=2)

  load_mock.assert_called_once()
  assert load_mock.call_args.kwargs["only_unanalyzed"] is True
  assert analyze_mock.await_count == 2  # batch_size=1, visit_logs 2건
  assert result.success_count == 2


def test_load_visit_logs_for_emotion_backfill_applies_limit_and_id() -> None:
  cursor = MagicMock()
  cursor.description = [("id",), ("photo_urls",)]
  cursor.fetchall.return_value = [(1, ["https://example.com/1.jpg"])]

  connection = MagicMock()
  connection.cursor.return_value.__enter__.return_value = cursor

  with patch("pipeline.log_emotion_sync.get_connection") as get_connection_mock:
    get_connection_mock.return_value.__enter__.return_value = connection
    logs = load_visit_logs_for_emotion_backfill(limit=1, visit_log_id="1")

  assert len(logs) == 1
  assert logs[0]["id"] == 1
  cursor.execute.assert_called_once()
  sql = cursor.execute.call_args.args[0]
  assert "log_emotion_tag" in sql
  assert "visit_log_photo" in sql
