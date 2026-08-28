"""Pipeline 및 DB 장소 레코드를 PlaceImageInput으로 변환."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from semantic_vector.constants import DEFAULT_IMAGES_PER_PLACE
from semantic_vector.models import PlaceImageInput


def _normalize_category(category: Any) -> str | None:
  if category is None:
    return None
  return str(category)


def _normalize_image_urls(value: Any) -> list[str]:
  if value is None:
    return []
  if isinstance(value, str):
    return [value]
  return [str(url) for url in value if url]


def select_analysis_image_urls(
  main_image_url: str,
  extra_image_urls: Sequence[str] | None = None,
  *,
  images_per_place: int = DEFAULT_IMAGES_PER_PLACE,
) -> list[str]:
  """대표사진을 첫 번째로 두고 분석에 사용할 이미지 URL을 선택한다."""
  selected: list[str] = []
  seen: set[str] = set()

  for url in (main_image_url, *list(extra_image_urls or [])):
    normalized = str(url).strip()
    if not normalized or normalized in seen:
      continue
    selected.append(normalized)
    seen.add(normalized)
    if len(selected) >= images_per_place:
      break

  return selected


def place_image_input_from_db_place(
  place: Mapping[str, Any],
  *,
  images_per_place: int = DEFAULT_IMAGES_PER_PLACE,
) -> PlaceImageInput | None:
  """DB place 레코드를 PlaceImageInput으로 변환한다.

  main_image_url이 없으면 extra_image_urls의 첫 이미지를 대표로 사용한다.
  이미지가 하나도 없으면 None을 반환한다.
  """
  extra_image_urls = _normalize_image_urls(place.get("extra_image_urls"))
  if not extra_image_urls:
    extra_image_urls = _normalize_image_urls(place.get("image_urls"))

  main_image_url = place.get("main_image_url") or place.get("image_url")
  if not main_image_url and extra_image_urls:
    main_image_url = extra_image_urls[0]
    extra_image_urls = extra_image_urls[1:]
  if not main_image_url:
    return None

  place_id = place.get("id") or place.get("place_id")
  if place_id is None:
    return None

  analysis_image_urls = select_analysis_image_urls(
    str(main_image_url),
    extra_image_urls,
    images_per_place=images_per_place,
  )

  return PlaceImageInput(
    place_id=str(place_id),
    image_id=str(place["image_id"]) if place.get("image_id") is not None else None,
    image_url=str(main_image_url),
    analysis_image_urls=analysis_image_urls,
    name=place.get("name"),
    region=place.get("region"),
    category=_normalize_category(place.get("category")),
  )


def place_image_inputs_from_db_places(
  places: Sequence[Mapping[str, Any]],
  *,
  images_per_place: int = DEFAULT_IMAGES_PER_PLACE,
) -> list[PlaceImageInput]:
  """DB place 목록을 분석 가능한 PlaceImageInput 목록으로 변환한다."""
  inputs: list[PlaceImageInput] = []
  for place in places:
    input_data = place_image_input_from_db_place(
      place,
      images_per_place=images_per_place,
    )
    if input_data is not None:
      inputs.append(input_data)
  return inputs


def map_place_to_semantic_input(
  place: Mapping[str, Any],
  *,
  images_per_place: int = DEFAULT_IMAGES_PER_PLACE,
) -> PlaceImageInput | None:
  """DB place 레코드를 Semantic Vector 입력으로 변환한다."""
  return place_image_input_from_db_place(place, images_per_place=images_per_place)


def place_image_input_from_pipeline(place: Mapping[str, Any]) -> PlaceImageInput:
  """단일 Pipeline 장소 dict를 PlaceImageInput으로 변환한다."""
  main_image_url = place.get("main_image_url") or place.get("image_url") or place.get("first_image")
  if not main_image_url:
    raise ValueError("image_url is required")

  place_id = place.get("place_id") or place.get("content_id") or place.get("id")
  if place_id is None:
    raise ValueError("place_id is required")

  extra_image_urls = _normalize_image_urls(place.get("extra_image_urls"))
  if not extra_image_urls:
    extra_image_urls = _normalize_image_urls(place.get("image_urls"))

  analysis_image_urls = select_analysis_image_urls(
    str(main_image_url),
    extra_image_urls,
  )

  image_id = place.get("image_id")
  return PlaceImageInput(
    place_id=str(place_id),
    image_id=str(image_id) if image_id is not None else None,
    image_url=str(main_image_url),
    analysis_image_urls=analysis_image_urls,
    name=place.get("name") or place.get("title"),
    region=place.get("region"),
    category=_normalize_category(place.get("category") or place.get("content_type")),
  )


def place_image_inputs_from_pipeline(
  places: Sequence[Mapping[str, Any]],
) -> list[PlaceImageInput]:
  """Pipeline 장소 목록을 PlaceImageInput 목록으로 변환한다."""
  return [place_image_input_from_pipeline(place) for place in places]
