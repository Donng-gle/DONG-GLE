"""semantic_score_store 테스트."""

from __future__ import annotations

from unittest.mock import MagicMock

from pipeline.semantic_score_store import (
  build_semantic_score_row,
  is_place_semantically_analyzed,
  save_semantic_analysis_results,
  summarize_place_batch_for_semantic,
)
from semantic_vector.models import (
  DetailScores,
  MajorScores,
  PlaceImageInput,
  SemanticVectorResult,
)


def _sample_result() -> SemanticVectorResult:
  detail = DetailScores.model_validate(
    {tag: 0.1 for tag in DetailScores.model_fields}
  )
  major = MajorScores.model_validate(
    {tag: 0.2 for tag in MajorScores.model_fields}
  )
  return SemanticVectorResult(
    place_id="1",
    image_id="img-1",
    detail_scores=detail,
    major_scores=major,
    detail_vector=[0.1] * 35,
    major_vector=[0.2] * 7,
    summary="조용한 공간",
    model_name="gpt-test",
    prompt_version="semantic-image-v4.1",
    tag_schema_version="v1",
    qdrant_point_id="place-1",
  )


def _sample_input() -> PlaceImageInput:
  return PlaceImageInput(
    place_id="1",
    image_id="img-1",
    image_url="https://example.com/1.jpg",
    analysis_image_urls=[
      "https://example.com/1.jpg",
      "https://example.com/1-extra.jpg",
    ],
    name="월영교",
    category="관광지",
  )


def test_build_semantic_score_row_includes_version_metadata() -> None:
  row = build_semantic_score_row(_sample_result(), _sample_input())

  assert row["place_id"] == 1
  assert row["analysis_image_count"] == 2
  assert row["model_name"] == "gpt-test"
  assert row["prompt_version"] == "semantic-image-v4.1"
  assert row["tag_schema_version"] == "v1"
  assert '"quiet"' in row["detail_scores"]


def test_save_semantic_analysis_results_executes_upsert() -> None:
  cursor = MagicMock()
  result = _sample_result()
  input_data = _sample_input()

  saved_count = save_semantic_analysis_results(cursor, [result], [input_data])

  assert saved_count == 1
  cursor.execute.assert_called_once()


def test_is_place_semantically_analyzed() -> None:
  cursor = MagicMock()
  cursor.fetchone.return_value = (1,)

  assert is_place_semantically_analyzed(
    cursor,
    1,
    model_name="gpt-test",
    prompt_version="semantic-image-v4.1",
    tag_schema_version="v1",
  )


def test_summarize_place_batch_for_semantic() -> None:
  places = [
    {"id": 1, "main_image_url": "https://example.com/1.jpg"},
    {"id": 2, "main_image_url": None},
    {"id": 3, "main_image_url": "https://example.com/3.jpg"},
  ]

  summary = summarize_place_batch_for_semantic(places, analyzed_place_ids={3})

  assert summary == {
    "saved_count": 3,
    "semantic_target_count": 1,
    "already_analyzed_count": 1,
    "skipped_no_image_count": 1,
  }
