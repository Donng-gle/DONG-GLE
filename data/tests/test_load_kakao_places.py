"""load_kakao_places 순수 로직(row 변환) 테스트."""

from __future__ import annotations

from pipeline.load_kakao_places import build_place_row


def _sample_item() -> dict:
  return {
    "kakao_id": "123456789",
    "name": "카페 봄날",
    "addr1": "경북 안동시 어느길 12",
    "lat": 36.5556,
    "lng": 128.7223,
    "tel": "054-000-0000",
    "photo_urls": ["https://dong-gle.onrender.com/images/proxy?ref=abc"],
  }


def test_build_place_row_synthesizes_kakao_content_id() -> None:
  row = build_place_row("카페", _sample_item())

  assert row["content_id"] == "kakao-123456789"
  assert row["category"] == "카페"
  assert row["main_image_url"] == "https://dong-gle.onrender.com/images/proxy?ref=abc"


def test_build_place_row_maps_content_type_id_by_category() -> None:
  cafe_row = build_place_row("카페", _sample_item())
  restaurant_row = build_place_row("식당", _sample_item())
  activity_row = build_place_row("액티비티", _sample_item())

  assert cafe_row["content_type_id"] == 39
  assert restaurant_row["content_type_id"] == 39
  assert activity_row["content_type_id"] == 28
