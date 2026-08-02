"""validators 테스트."""

from __future__ import annotations

import math

import pytest

from semantic_vector.constants import DETAIL_TAG_ORDER
from semantic_vector.exceptions import TagSchemaMismatchError, VectorDimensionError
from semantic_vector.validators import (
  validate_detail_score_keys,
  validate_score,
  validate_vector_dimensions,
)


def test_validate_score_accepts_valid_range() -> None:
  assert validate_score(0.0, "quiet") == 0.0
  assert validate_score(1.0, "quiet") == 1.0
  assert validate_score(0.42, "quiet") == 0.42


def test_validate_score_rejects_missing_tag() -> None:
  scores = {tag: 0.5 for tag in DETAIL_TAG_ORDER}
  del scores["quiet"]
  with pytest.raises(TagSchemaMismatchError):
    validate_detail_score_keys(scores)


def test_validate_score_rejects_extra_tag() -> None:
  scores = {tag: 0.5 for tag in DETAIL_TAG_ORDER}
  scores["unknown"] = 0.1
  with pytest.raises(TagSchemaMismatchError):
    validate_detail_score_keys(scores)


def test_validate_score_rejects_negative() -> None:
  with pytest.raises(ValueError, match="between 0.0 and 1.0"):
    validate_score(-0.1, "quiet")


def test_validate_score_rejects_above_one() -> None:
  with pytest.raises(ValueError, match="between 0.0 and 1.0"):
    validate_score(1.1, "quiet")


def test_validate_score_rejects_nan() -> None:
  with pytest.raises(ValueError, match="finite"):
    validate_score(float("nan"), "quiet")


def test_validate_score_rejects_infinity() -> None:
  with pytest.raises(ValueError, match="finite"):
    validate_score(float("inf"), "quiet")


def test_validate_detail_score_keys_accepts_all_tags() -> None:
  scores = {tag: 0.5 for tag in DETAIL_TAG_ORDER}
  validate_detail_score_keys(scores)


def test_validate_vector_dimensions() -> None:
  validate_vector_dimensions([0.5] * 35, [0.5] * 7)


def test_validate_vector_dimensions_rejects_detail_length() -> None:
  with pytest.raises(VectorDimensionError):
    validate_vector_dimensions([0.5] * 34, [0.5] * 7)


def test_validate_vector_dimensions_rejects_major_length() -> None:
  with pytest.raises(VectorDimensionError):
    validate_vector_dimensions([0.5] * 35, [0.5] * 6)
