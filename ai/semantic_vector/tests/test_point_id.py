"""point_id 테스트."""

from __future__ import annotations

from semantic_vector.point_id import build_point_id


def test_build_point_id_with_image_id_differs_from_place_only() -> None:
  place_only = build_point_id("42")
  image_a = build_point_id("42", "42-img1")
  image_b = build_point_id("42", "42-img2")
  assert place_only != image_a
  assert image_a != image_b


def test_build_point_id_is_stable() -> None:
  assert build_point_id("42", "42-img1") == build_point_id("42", "42-img1")
