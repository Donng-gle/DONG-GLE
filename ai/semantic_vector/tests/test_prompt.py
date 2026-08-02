"""prompt 분기 테스트."""

from __future__ import annotations

import pytest

from semantic_vector.models import PlaceImageInput
from semantic_vector.prompt import (
  FOOD_CATEGORY_ANALYSIS_PROMPT,
  GENERAL_PLACE_ANALYSIS_PROMPT,
  build_user_prompt,
  resolve_system_prompt,
)


@pytest.fixture
def general_place() -> PlaceImageInput:
  return PlaceImageInput(
    place_id="1",
    image_url="https://example.com/place.jpg",
    name="월영교",
    region="안동",
    category="관광지",
  )


@pytest.fixture
def restaurant_place() -> PlaceImageInput:
  return PlaceImageInput(
    place_id="2",
    image_url="https://example.com/food.jpg",
    name="김정순명인의집",
    region="안동",
    category="식당",
  )


@pytest.fixture
def cafe_place() -> PlaceImageInput:
  return PlaceImageInput(
    place_id="3",
    image_url="https://example.com/cafe.jpg",
    name="카페뒤뜰",
    region="안동",
    category="카페",
  )


def test_resolve_system_prompt_uses_general_prompt_for_non_food_category(
  general_place: PlaceImageInput,
) -> None:
  assert resolve_system_prompt(general_place) == GENERAL_PLACE_ANALYSIS_PROMPT


@pytest.mark.parametrize("category", ["식당", "카페"])
def test_resolve_system_prompt_uses_food_prompt_for_food_categories(category: str) -> None:
  place = PlaceImageInput(
    place_id="food",
    image_url="https://example.com/food.jpg",
    category=category,
  )
  assert resolve_system_prompt(place) == FOOD_CATEGORY_ANALYSIS_PROMPT


def test_build_user_prompt_for_general_place(general_place: PlaceImageInput) -> None:
  prompt = build_user_prompt(general_place)

  assert "월영교" not in prompt
  assert "안동" not in prompt
  assert "FOOD" not in prompt
  assert "35개 세부 태그 점수" in prompt


def test_build_user_prompt_for_food_category(restaurant_place: PlaceImageInput) -> None:
  prompt = build_user_prompt(restaurant_place)

  assert "김정순명인의집" not in prompt
  assert "식당" not in prompt
  assert "FOOD" in prompt
  assert "SPACE" in prompt
  assert "nature_friendly" in prompt


def test_food_prompt_includes_conditional_analysis_instructions() -> None:
  assert "FOOD:" in FOOD_CATEGORY_ANALYSIS_PROMPT
  assert "SPACE:" in FOOD_CATEGORY_ANALYSIS_PROMPT
  assert "[FOOD 이미지 분석 규칙]" in FOOD_CATEGORY_ANALYSIS_PROMPT
  assert "[SPACE 이미지 분석 규칙]" in FOOD_CATEGORY_ANALYSIS_PROMPT


def test_general_prompt_does_not_include_food_branching() -> None:
  assert "FOOD:" not in GENERAL_PLACE_ANALYSIS_PROMPT
  assert "[FOOD 이미지 분석 규칙]" not in GENERAL_PLACE_ANALYSIS_PROMPT
