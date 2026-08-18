"""input_mapper DB 매핑 테스트."""

from __future__ import annotations

import pytest

from semantic_vector.input_mapper import (
  map_place_to_semantic_input,
  place_image_input_from_db_place,
  place_image_inputs_from_db_places,
  select_analysis_image_urls,
)


def test_select_analysis_image_urls_puts_main_first_and_deduplicates() -> None:
  urls = select_analysis_image_urls(
    "https://example.com/main.jpg",
    [
      "https://example.com/main.jpg",
      "https://example.com/extra-1.jpg",
      "https://example.com/extra-2.jpg",
      "https://example.com/extra-3.jpg",
    ],
    images_per_place=3,
  )

  assert urls == [
    "https://example.com/main.jpg",
    "https://example.com/extra-1.jpg",
    "https://example.com/extra-2.jpg",
  ]


def test_place_image_input_from_db_place_success() -> None:
  result = place_image_input_from_db_place(
    {
      "id": 123,
      "name": "월영교",
      "category": "관광지",
      "main_image_url": "https://example.com/main.jpg",
      "extra_image_urls": [
        "https://example.com/extra-1.jpg",
        "https://example.com/extra-2.jpg",
      ],
    }
  )

  assert result is not None
  assert result.place_id == "123"
  assert result.image_url == "https://example.com/main.jpg"
  assert result.analysis_image_urls == [
    "https://example.com/main.jpg",
    "https://example.com/extra-1.jpg",
    "https://example.com/extra-2.jpg",
  ]
  assert result.name == "월영교"
  assert result.category == "관광지"


def test_place_image_input_from_db_place_returns_none_without_image() -> None:
  assert place_image_input_from_db_place({"id": 1, "name": "이미지 없음"}) is None


def test_place_image_input_from_db_place_uses_extra_when_main_missing() -> None:
  result = place_image_input_from_db_place(
    {
      "id": 58,
      "name": "부용대",
      "category": "관광지",
      "main_image_url": None,
      "extra_image_urls": [
        "https://example.com/a.png",
        "https://example.com/b.png",
        "https://example.com/c.png",
      ],
    },
    images_per_place=3,
  )

  assert result is not None
  assert result.image_url == "https://example.com/a.png"
  assert result.analysis_image_urls == [
    "https://example.com/a.png",
    "https://example.com/b.png",
    "https://example.com/c.png",
  ]


def test_place_image_input_from_db_place_returns_none_without_id() -> None:
  assert (
    place_image_input_from_db_place(
      {"name": "월영교", "main_image_url": "https://example.com/main.jpg"}
    )
    is None
  )


def test_place_image_inputs_from_db_places_filters_missing_images() -> None:
  places = [
    {"id": 1, "main_image_url": "https://example.com/1.jpg", "category": "관광지"},
    {"id": 2, "main_image_url": None, "category": "식당"},
    {"id": 3, "main_image_url": "https://example.com/3.jpg", "category": "카페"},
  ]

  results = place_image_inputs_from_db_places(places)

  assert len(results) == 2
  assert [item.place_id for item in results] == ["1", "3"]
  assert results[0].analysis_image_urls == ["https://example.com/1.jpg"]


def test_map_place_to_semantic_input_alias() -> None:
  place = {"id": 9, "main_image_url": "https://example.com/9.jpg"}
  assert map_place_to_semantic_input(place) == place_image_input_from_db_place(place)
