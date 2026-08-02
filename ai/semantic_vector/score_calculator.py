"""35개 Detail Score로 7개 Major Score를 계산."""

from __future__ import annotations

from semantic_vector.constants import DETAIL_TAG_GROUPS, MAJOR_TAG_ORDER
from semantic_vector.models import DetailScores, MajorScores


def calculate_major_scores(detail_scores: DetailScores) -> MajorScores:
  """각 Major Score는 소속 Detail Score 5개의 산술평균이다."""
  major_values: dict[str, float] = {}
  detail_dict = detail_scores.model_dump()

  for major_tag in MAJOR_TAG_ORDER:
    detail_tags = DETAIL_TAG_GROUPS[major_tag]
    total = sum(detail_dict[detail_tag] for detail_tag in detail_tags)
    major_values[major_tag] = total / len(detail_tags)

  return MajorScores(**major_values)
