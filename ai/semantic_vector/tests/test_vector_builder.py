"""vector_builder 테스트."""

from __future__ import annotations

from semantic_vector.constants import DETAIL_TAG_ORDER, MAJOR_TAG_ORDER
from semantic_vector.score_calculator import calculate_major_scores
from semantic_vector.tests.conftest import make_detail_scores
from semantic_vector.vector_builder import build_detail_vector, build_major_vector


def test_build_detail_vector_length() -> None:
  detail_scores = make_detail_scores()
  assert len(build_detail_vector(detail_scores)) == 35


def test_build_major_vector_length() -> None:
  detail_scores = make_detail_scores()
  major_scores = calculate_major_scores(detail_scores)
  assert len(build_major_vector(major_scores)) == 7


def test_build_detail_vector_fixed_order() -> None:
  detail_scores = make_detail_scores(quiet=0.1, artistic=0.9)
  vector = build_detail_vector(detail_scores)
  assert vector[0] == 0.1
  assert vector[-1] == 0.9
  assert vector == [getattr(detail_scores, tag) for tag in DETAIL_TAG_ORDER]


def test_build_major_vector_fixed_order() -> None:
  detail_scores = make_detail_scores()
  major_scores = calculate_major_scores(detail_scores)
  vector = build_major_vector(major_scores)
  assert vector == [getattr(major_scores, tag) for tag in MAJOR_TAG_ORDER]


def test_detail_vector_ignores_dict_insertion_order() -> None:
  detail_scores = make_detail_scores(quiet=0.2, artistic=0.8)
  shuffled_dict = {tag: getattr(detail_scores, tag) for tag in reversed(DETAIL_TAG_ORDER)}
  rebuilt = make_detail_scores(**shuffled_dict)
  assert build_detail_vector(rebuilt) == build_detail_vector(detail_scores)
