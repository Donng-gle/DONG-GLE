"""prompt 테스트."""

from __future__ import annotations

import pytest

from semantic_vector.models import PlaceImageInput
from semantic_vector.prompt import (
  PLACE_ANALYSIS_USER_PROMPT,
  PLACE_SPACE_ANALYSIS_PROMPT,
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


@pytest.mark.parametrize("category", ["관광지", "문화시설", "식당", "카페"])
def test_resolve_system_prompt_returns_same_prompt_for_all_categories(
  category: str,
) -> None:
  place = PlaceImageInput(
    place_id="1",
    image_url="https://example.com/image.jpg",
    category=category,
  )

  assert resolve_system_prompt(place) == PLACE_SPACE_ANALYSIS_PROMPT


def test_build_user_prompt_does_not_include_place_metadata(
  general_place: PlaceImageInput,
  restaurant_place: PlaceImageInput,
) -> None:
  for place in (general_place, restaurant_place):
    prompt = build_user_prompt(place)

    assert place.name not in prompt
    assert place.region not in prompt
    assert place.category not in prompt
    assert prompt == PLACE_ANALYSIS_USER_PROMPT


def test_place_space_prompt_focuses_on_space_not_food_branching() -> None:
  assert "FOOD:" not in PLACE_SPACE_ANALYSIS_PROMPT
  assert "SPACE:" not in PLACE_SPACE_ANALYSIS_PROMPT
  assert "[FOOD 이미지 분석 규칙]" not in PLACE_SPACE_ANALYSIS_PROMPT
  assert "공간·건축·시설·인테리어·자연환경·경관" in PLACE_SPACE_ANALYSIS_PROMPT
  assert "음식·음료가 보여도 맛" in PLACE_SPACE_ANALYSIS_PROMPT


def test_place_space_prompt_evaluates_lively_tags_without_people() -> None:
  assert "사람이 없거나 거의 없을 수 있다" in PLACE_SPACE_ANALYSIS_PROMPT
  assert "사람 유무에만 의존하지 말고" in PLACE_SPACE_ANALYSIS_PROMPT
  assert "사람이 보이지 않으면 crowded" not in PLACE_SPACE_ANALYSIS_PROMPT
  assert "공유 테이블" in PLACE_SPACE_ANALYSIS_PROMPT
