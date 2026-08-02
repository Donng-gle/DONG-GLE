"""place.category 기반 분류 헬퍼."""

from __future__ import annotations

# schema.sql / schema.dbml place_category enum과 동기화
FOOD_CATEGORIES: frozenset[str] = frozenset({"식당", "카페"})


def is_food_category(category: str | None) -> bool:
  """음식 관련 place_category 여부를 판단한다."""
  if category is None:
    return False
  return category in FOOD_CATEGORIES
