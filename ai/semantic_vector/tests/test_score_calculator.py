"""score_calculator 테스트."""

from __future__ import annotations

import pytest

from semantic_vector.constants import DETAIL_TAG_GROUPS, MAJOR_TAG_ORDER
from semantic_vector.score_calculator import aggregate_detail_scores, calculate_major_scores
from semantic_vector.tests.conftest import make_detail_scores


def test_major_scores_are_five_detail_averages() -> None:
  detail_scores = make_detail_scores(
    quiet=0.1,
    peaceful=0.2,
    spacious=0.3,
    nature_friendly=0.4,
    stay_long=0.5,
  )
  major_scores = calculate_major_scores(detail_scores)

  expected = (0.1 + 0.2 + 0.3 + 0.4 + 0.5) / 5
  assert major_scores.relaxing == expected


def test_all_major_scores_are_created() -> None:
  major_scores = calculate_major_scores(make_detail_scores())
  for major_tag in MAJOR_TAG_ORDER:
    assert hasattr(major_scores, major_tag)


def test_same_input_same_output() -> None:
  detail_scores = make_detail_scores(crowded=0.8)
  first = calculate_major_scores(detail_scores)
  second = calculate_major_scores(detail_scores)
  assert first == second


def test_input_object_is_not_mutated() -> None:
  detail_scores = make_detail_scores()
  snapshot = detail_scores.model_dump()
  calculate_major_scores(detail_scores)
  assert detail_scores.model_dump() == snapshot


def test_major_scores_are_not_rounded() -> None:
  detail_scores = make_detail_scores(
    quiet=0.11,
    peaceful=0.22,
    spacious=0.33,
    nature_friendly=0.44,
    stay_long=0.55,
  )
  major_scores = calculate_major_scores(detail_scores)
  assert major_scores.relaxing == (0.11 + 0.22 + 0.33 + 0.44 + 0.55) / 5


def test_each_group_uses_five_tags() -> None:
  for detail_tags in DETAIL_TAG_GROUPS.values():
    assert len(detail_tags) == 5


def test_aggregate_detail_scores_averages_per_tag() -> None:
  first = make_detail_scores(quiet=0.2, peaceful=0.4)
  second = make_detail_scores(quiet=0.6, peaceful=0.8)
  aggregated = aggregate_detail_scores([first, second])

  assert aggregated.quiet == pytest.approx(0.4)
  assert aggregated.peaceful == pytest.approx(0.6)
