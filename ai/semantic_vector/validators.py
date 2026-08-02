"""GPT 응답 및 벡터 검증."""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence

from semantic_vector.constants import DETAIL_TAG_ORDER
from semantic_vector.exceptions import TagSchemaMismatchError, VectorDimensionError


def validate_score(value: float, field_name: str) -> float:
  """단일 태그 점수를 검증한다."""
  if not isinstance(value, (int, float)):
    raise ValueError(f"{field_name} must be a number")
  numeric = float(value)
  if not math.isfinite(numeric):
    raise ValueError(f"{field_name} must be a finite number")
  if numeric < 0.0 or numeric > 1.0:
    raise ValueError(f"{field_name} must be between 0.0 and 1.0")
  return numeric


def validate_detail_score_keys(scores: Mapping[str, float]) -> None:
  """35개 Detail 태그 키 집합을 검증한다."""
  expected = set(DETAIL_TAG_ORDER)
  actual = set(scores.keys())
  if actual != expected:
    missing = sorted(expected - actual)
    extra = sorted(actual - expected)
    raise TagSchemaMismatchError(
      f"detail score keys mismatch: missing={missing}, extra={extra}"
    )


def validate_vector_dimensions(
  detail_vector: Sequence[float],
  major_vector: Sequence[float],
) -> None:
  """Detail/Major 벡터 차원을 검증한다."""
  if len(detail_vector) != 35:
    raise VectorDimensionError(
      f"detail_vector must have length 35, got {len(detail_vector)}"
    )
  if len(major_vector) != 7:
    raise VectorDimensionError(
      f"major_vector must have length 7, got {len(major_vector)}"
    )
