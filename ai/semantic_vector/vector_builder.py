"""고정 태그 순서로 벡터를 생성."""

from __future__ import annotations

from semantic_vector.constants import DETAIL_TAG_ORDER, MAJOR_TAG_ORDER
from semantic_vector.models import DetailScores, MajorScores


def build_detail_vector(detail_scores: DetailScores) -> list[float]:
  """35차원 Detail Vector를 생성한다."""
  return [getattr(detail_scores, tag) for tag in DETAIL_TAG_ORDER]


def build_major_vector(major_scores: MajorScores) -> list[float]:
  """7차원 Major Vector를 생성한다."""
  return [getattr(major_scores, tag) for tag in MAJOR_TAG_ORDER]
