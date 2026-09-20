"""log_emotion_tag_store 테스트."""

from __future__ import annotations

from unittest.mock import MagicMock

from pipeline.log_emotion_tag_store import (
  build_log_emotion_tag_rows,
  count_log_emotion_status,
  is_visit_log_emotion_analyzed,
  save_log_emotion_tags,
)
from semantic_vector.models import DetailScores, MajorScores, PlaceImageInput, SemanticVectorResult


def _sample_result() -> SemanticVectorResult:
  detail = DetailScores.model_validate({tag: 0.1 for tag in DetailScores.model_fields})
  major = MajorScores.model_validate(
    {
      "relaxing": 0.8,
      "lively": 0.1,
      "romantic": 0.05,
      "local": 0.2,
      "photogenic": 0.6,
      "traditional": 0.9,
      "modern": 0.1,
    }
  )
  return SemanticVectorResult(
    place_id="42",
    image_id=None,
    detail_scores=detail,
    major_scores=major,
    detail_vector=[0.1] * 35,
    major_vector=[0.5] * 7,
    summary="조용한 산책로",
    model_name="gpt-test",
    prompt_version="semantic-image-v4.1",
    tag_schema_version="v1",
    qdrant_point_id="unused",
  )


def _sample_input() -> PlaceImageInput:
  return PlaceImageInput(
    place_id="42",
    image_url="https://example.com/log1.jpg",
    analysis_image_urls=["https://example.com/log1.jpg", "https://example.com/log2.jpg"],
  )


def test_build_log_emotion_tag_rows_returns_one_row_per_tag() -> None:
  rows = build_log_emotion_tag_rows(_sample_result(), _sample_input())

  assert len(rows) == 7
  assert all(row["visit_log_id"] == 42 for row in rows)
  tags = {row["tag"] for row in rows}
  assert tags == {"relaxing", "lively", "romantic", "local", "photogenic", "traditional", "modern"}
  traditional_row = next(row for row in rows if row["tag"] == "traditional")
  assert traditional_row["score"] == 0.9


def test_build_log_emotion_tag_rows_keeps_low_scores_without_threshold() -> None:
  # threshold로 거르지 않고 낮은 점수(romantic=0.05)도 그대로 저장돼야 함
  rows = build_log_emotion_tag_rows(_sample_result(), _sample_input())

  romantic_row = next(row for row in rows if row["tag"] == "romantic")
  assert romantic_row["score"] == 0.05


def test_save_log_emotion_tags_executes_seven_upserts_per_visit_log() -> None:
  cursor = MagicMock()
  result = _sample_result()
  input_data = _sample_input()

  saved_count = save_log_emotion_tags(cursor, [result], [input_data])

  assert saved_count == 1
  assert cursor.execute.call_count == 7


def test_is_visit_log_emotion_analyzed() -> None:
  cursor = MagicMock()
  cursor.fetchone.return_value = (1,)

  assert is_visit_log_emotion_analyzed(cursor, 42)


def test_count_log_emotion_status() -> None:
  cursor = MagicMock()
  cursor.fetchone.return_value = (5, 3, 2)

  status = count_log_emotion_status(cursor)

  assert status == {"analyzed_count": 5, "pending_count": 3, "no_photo_count": 2}
