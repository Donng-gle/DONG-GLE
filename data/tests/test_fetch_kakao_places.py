"""fetch_kakao_places 순수 로직(중복 판단) 테스트."""

from __future__ import annotations

from pipeline.fetch_kakao_places import (
  is_delivery_only,
  is_duplicate_of_existing,
  is_franchise,
  is_lodging,
  is_valid_activity_category,
  is_within_andong,
  normalize_name,
)


def test_normalize_name_strips_special_chars_and_spaces() -> None:
  assert normalize_name("카페 봄날 (안동점)") == "카페봄날안동점"


def test_is_duplicate_when_name_and_coords_close() -> None:
  existing = [{"name": "월영교", "lat": 36.5555, "lng": 128.7222}]
  doc = {"place_name": "월영교", "y": "36.5556", "x": "128.7223"}  # 약 10m 이내

  assert is_duplicate_of_existing(doc, existing) is True


def test_is_not_duplicate_when_far_even_if_name_matches() -> None:
  existing = [{"name": "월영교", "lat": 36.5555, "lng": 128.7222}]
  doc = {"place_name": "월영교", "y": "36.7000", "x": "128.9000"}  # 훨씬 멂

  assert is_duplicate_of_existing(doc, existing) is False


def test_is_not_duplicate_when_close_but_different_name() -> None:
  existing = [{"name": "월영교", "lat": 36.5555, "lng": 128.7222}]
  doc = {"place_name": "이디야커피 안동점", "y": "36.5556", "x": "128.7223"}

  assert is_duplicate_of_existing(doc, existing) is False


def test_is_duplicate_returns_false_for_empty_existing_places() -> None:
  doc = {"place_name": "새로운 카페", "y": "36.5556", "x": "128.7223"}

  assert is_duplicate_of_existing(doc, []) is False


def test_is_franchise_detects_recognized_chain_brand_segment() -> None:
  doc = {"place_name": "스타벅스 안동시청점", "category_name": "음식점 > 카페 > 커피전문점 > 스타벅스"}

  assert is_franchise(doc) is True


def test_is_franchise_false_for_generic_category_segment() -> None:
  doc = {"place_name": "나예누리", "category_name": "음식점 > 카페"}

  assert is_franchise(doc) is False


def test_is_franchise_avoids_false_positive_from_substring_overlap() -> None:
  # "국수"가 상호명 중간에 우연히 들어가지만 상호명이 "국수"로 시작하지는 않음
  doc = {"place_name": "안동참마손국수종가 본점", "category_name": "음식점 > 한식 > 국수"}

  assert is_franchise(doc) is False


def test_is_franchise_handles_missing_category_name() -> None:
  doc = {"place_name": "이름만 있는 곳", "category_name": ""}

  assert is_franchise(doc) is False


def test_is_within_andong_checks_road_address_first() -> None:
  assert is_within_andong({"road_address_name": "경북 안동시 퇴계로 1", "address_name": "경북 예천군"}) is True


def test_is_within_andong_falls_back_to_address_name() -> None:
  assert is_within_andong({"road_address_name": "", "address_name": "경북 안동시 목성동 1"}) is True


def test_is_within_andong_rejects_other_county() -> None:
  assert is_within_andong({"road_address_name": "경북 예천군 보문면", "address_name": ""}) is False


def test_is_lodging_excludes_pension_and_camping() -> None:
  assert is_lodging({"category_name": "여행 > 숙박 > 펜션"}) is True
  assert is_lodging({"category_name": "여행 > 숙박 > 야영,캠핑장"}) is True
  assert is_lodging({"category_name": "음식점 > 카페"}) is False


def test_is_delivery_only_excludes_delivery_lunchbox() -> None:
  assert is_delivery_only({"category_name": "음식점 > 도시락 > 배달도시락"}) is True
  assert is_delivery_only({"category_name": "음식점 > 한식"}) is False


def test_is_valid_activity_category_allows_sports_and_experience_travel() -> None:
  assert is_valid_activity_category({"category_name": "스포츠,레저 > 승마 > 승마장"}) is True
  assert is_valid_activity_category({"category_name": "여행 > 체험여행 > 정보화,체험마을"}) is True


def test_is_valid_activity_category_rejects_unrelated_matches() -> None:
  # "체험"이라는 키워드로 잘못 걸린 학습지 방문교육/진로상담센터 등
  assert is_valid_activity_category({"category_name": "교육,학문 > 학습교재 > 학습지"}) is False
  assert is_valid_activity_category({"category_name": "사회,공공기관 > 단체,협회"}) is False
  assert is_valid_activity_category({"category_name": "여행 > 관광,명소 > 문화유적 > 생가,고택"}) is False
