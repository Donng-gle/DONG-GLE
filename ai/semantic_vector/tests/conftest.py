"""테스트 공통 fixture."""

from __future__ import annotations

from semantic_vector.constants import DETAIL_TAG_ORDER
from semantic_vector.models import DetailScores


def make_detail_scores(**overrides: float) -> DetailScores:
  values = {tag: 0.5 for tag in DETAIL_TAG_ORDER}
  values.update(overrides)
  return DetailScores(**values)
