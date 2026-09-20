"""categories 테스트."""

from __future__ import annotations

import pytest

from semantic_vector.categories import FOOD_CATEGORIES, is_food_category


@pytest.mark.parametrize(
  "category",
  sorted(FOOD_CATEGORIES),
)
def test_is_food_category_returns_true_for_food_categories(category: str) -> None:
  assert is_food_category(category) is True


@pytest.mark.parametrize(
  "category",
  ["관광지", "액티비티", "문화공간", "축제행사"],
)
def test_is_food_category_returns_false_for_non_food_categories(category: str) -> None:
  assert is_food_category(category) is False


@pytest.mark.parametrize("category", [None, "", "식당가", "RESTAURANT"])
def test_is_food_category_returns_false_for_unknown_values(category: str | None) -> None:
  assert is_food_category(category) is False
