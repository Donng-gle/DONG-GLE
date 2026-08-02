"""Pipeline 및 DB 장소 레코드를 PlaceImageInput으로 변환."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from semantic_vector.models import PlaceImageInput


def _normalize_category(category: Any) -> str | None:
  if category is None:
    return None
  return str(category)


def place_image_input_from_db_place(place: Mapping[str, Any]) -> PlaceImageInput | None:
  """DB place 레코드를 PlaceImageInput으로 변환한다.

  main_image_url이 없으면 분석 대상이 아니므로 None을 반환한다.
  """
  image_url = place.get("main_image_url") or place.get("image_url")
  if not image_url:
    return None

  place_id = place.get("id") or place.get("place_id")
  if place_id is None:
    return None

  return PlaceImageInput(
    place_id=str(place_id),
    image_id=str(place["image_id"]) if place.get("image_id") is not None else None,
    image_url=str(image_url),
    name=place.get("name"),
    region=place.get("region"),
    category=_normalize_category(place.get("category")),
  )


def place_image_inputs_from_db_places(
  places: Sequence[Mapping[str, Any]],
) -> list[PlaceImageInput]:
  """DB place 목록을 분석 가능한 PlaceImageInput 목록으로 변환한다."""
  inputs: list[PlaceImageInput] = []
  for place in places:
    input_data = place_image_input_from_db_place(place)
    if input_data is not None:
      inputs.append(input_data)
  return inputs


def map_place_to_semantic_input(place: Mapping[str, Any]) -> PlaceImageInput | None:
  """DB place 레코드를 Semantic Vector 입력으로 변환한다."""
  return place_image_input_from_db_place(place)


def place_image_input_from_pipeline(place: Mapping[str, Any]) -> PlaceImageInput:
  """단일 Pipeline 장소 dict를 PlaceImageInput으로 변환한다."""
  image_url = place.get("image_url") or place.get("main_image_url") or place.get("first_image")
  if not image_url:
    raise ValueError("image_url is required")

  place_id = place.get("place_id") or place.get("content_id") or place.get("id")
  if place_id is None:
    raise ValueError("place_id is required")

  image_id = place.get("image_id")
  return PlaceImageInput(
    place_id=str(place_id),
    image_id=str(image_id) if image_id is not None else None,
    image_url=str(image_url),
    name=place.get("name") or place.get("title"),
    region=place.get("region"),
    category=_normalize_category(place.get("category") or place.get("content_type")),
  )


def place_image_inputs_from_pipeline(
  places: Sequence[Mapping[str, Any]],
) -> list[PlaceImageInput]:
  """Pipeline 장소 목록을 PlaceImageInput 목록으로 변환한다."""
  return [place_image_input_from_pipeline(place) for place in places]
