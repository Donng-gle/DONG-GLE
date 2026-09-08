"""카카오 로컬 API로 안동시 카페/식당/액티비티 신규 장소를 발굴하고, 가능하면 Google Places로
사진까지 보완한다.

TourAPI가 이미 수집한 기존 장소와 겹치지 않는 것만 남긴다. Google Places에서 사진을 못 찾은
후보도 장소 정보(이름/주소/좌표/전화)만으로 적재한다 — 리뷰를 남길 장소 자체가 부족한 문제가
더 급해서, 사진 없는 장소는 이후 사용자가 방문 기록에 사진을 올리면 그 사진들이
log_emotion_tag로 누적되어 감성 신호를 대신 채워준다 (2026-09-08 결정, decision-log 참고,
place_semantic_vector=공식 사진 기준선 / log_emotion_tag=방문자 누적 신호라는 기존 이원 구조와
자연스럽게 맞물림). main_image_url은 사진이 없으면 NULL로 저장된다.

사용 예:
  python -m pipeline.fetch_kakao_places
"""

from __future__ import annotations

import json
import re
import time
from datetime import datetime

import requests

from pipeline.config import get_kakao_config
from pipeline.db import get_connection
from pipeline.paths import KAKAO_ROOT
from pipeline.place_photo_enrichment import find_place_photos
from pipeline.tel_enrichment import haversine_m, is_same_place

NEW_PLACES_PATH = KAKAO_ROOT / "new_places.json"

# 안동시청 좌표 (기존 course_optimizer 기본 좌표와 동일하게 사용, decision-log 2026-08-30 참고)
ANDONG_CENTER_LAT = 36.5684
ANDONG_CENTER_LNG = 128.7294
SEARCH_RADIUS_M = 20_000  # 카카오 로컬 API 반경 검색 최대값
PAGE_SIZE = 15
MAX_PAGE = 3  # 카카오 로컬 검색은 페이지당 15건, 최대 45건까지만 반환

# category_group_code 기준으로 바로 검색 가능한 카테고리
CATEGORY_GROUP_CODES = {
  "카페": "CE7",
  "식당": "FD6",
}

# 액티비티는 카카오 카테고리 그룹 코드가 없어 키워드 검색으로 대체
ACTIVITY_KEYWORDS = ["체험", "레포츠", "액티비티", "캠핑장", "짚라인", "래프팅", "승마"]

NAME_CHARS_PATTERN = re.compile(r"[^0-9a-zA-Z가-힣]")

DEDUP_DISTANCE_M = 150

# 액티비티는 키워드 검색이라 오탐(학습지 방문교육, 진로상담센터 등)이 많이 섞여서
# category_name 접두사 화이트리스트로 한 번 더 좁힌다. 스포츠,레저(승마·수상스포츠 등)와
# 여행 > 체험여행(농어촌체험마을 등)만 인정한다.
ACTIVITY_CATEGORY_PREFIXES = ("스포츠,레저", "여행 > 체험여행")


def normalize_name(name: str) -> str:
  return NAME_CHARS_PATTERN.sub("", name or "").lower()


def is_franchise(doc: dict) -> bool:
  """카카오 category_name의 마지막 세그먼트가 브랜드명이면(place_name이 그 이름으로 시작하면)
  프랜차이즈로 간주한다.

  카카오는 스타벅스·이디야커피처럼 체인점을 인식하면 category_name 마지막 세그먼트에
  일반 업종명(예: "카페", "커피전문점") 대신 브랜드명을 넣는다
  (예: "음식점 > 카페 > 커피전문점 > 스타벅스"). place_name이 그 세그먼트로 시작하는지로
  판단한다 — "국수" 같은 일반 업종명은 상호명 앞부분과 우연히 겹치는 경우가 거의 없어
  단순 부분 문자열 포함보다 오탐이 적다 (예: "안동참마손국수종가"는 "국수"로 시작하지 않음).
  브랜드 매장은 전국 어디서나 볼 수 있어 개인화 여행 코스 추천 의미가 작다는 기존 원칙과
  동일하게 적용한다 (2026-07-17 쇼핑 카테고리 결정 참고).
  """
  segments = [part.strip() for part in (doc.get("category_name") or "").split(">")]
  if not segments or not segments[-1]:
    return False
  brand_segment = segments[-1]
  place_name = (doc.get("place_name") or "").strip()
  return place_name.startswith(brand_segment)


def _request(path: str, params: dict) -> list[dict]:
  config = get_kakao_config()
  response = requests.get(
    f"{config.base_url}/{path}",
    headers={"Authorization": f"KakaoAK {config.rest_api_key}"},
    params=params,
    timeout=30,
  )
  response.raise_for_status()
  return response.json()


def search_by_category(category_group_code: str) -> list[dict]:
  """category_group_code + 반경으로 안동시 인근 장소를 페이지 끝까지 조회한다."""
  documents: list[dict] = []
  for page in range(1, MAX_PAGE + 1):
    payload = _request(
      "search/category.json",
      {
        "category_group_code": category_group_code,
        "x": ANDONG_CENTER_LNG,
        "y": ANDONG_CENTER_LAT,
        "radius": SEARCH_RADIUS_M,
        "page": page,
        "size": PAGE_SIZE,
        "sort": "distance",
      },
    )
    documents.extend(payload.get("documents", []))
    if payload.get("meta", {}).get("is_end", True):
      break
    time.sleep(0.1)
  return documents


def search_by_keyword(keyword: str) -> list[dict]:
  """키워드 + 반경으로 안동시 인근 장소를 페이지 끝까지 조회한다."""
  documents: list[dict] = []
  for page in range(1, MAX_PAGE + 1):
    payload = _request(
      "search/keyword.json",
      {
        "query": keyword,
        "x": ANDONG_CENTER_LNG,
        "y": ANDONG_CENTER_LAT,
        "radius": SEARCH_RADIUS_M,
        "page": page,
        "size": PAGE_SIZE,
        "sort": "distance",
      },
    )
    documents.extend(payload.get("documents", []))
    if payload.get("meta", {}).get("is_end", True):
      break
    time.sleep(0.1)
  return documents


def collect_candidates() -> dict[str, list[dict]]:
  """카테고리별 카카오 후보를 kakao place id 기준으로 중복 제거해서 모은다."""
  candidates_by_category: dict[str, dict[str, dict]] = {
    "카페": {},
    "식당": {},
    "액티비티": {},
  }

  for category, group_code in CATEGORY_GROUP_CODES.items():
    for doc in search_by_category(group_code):
      candidates_by_category[category][doc["id"]] = doc

  for keyword in ACTIVITY_KEYWORDS:
    for doc in search_by_keyword(keyword):
      candidates_by_category["액티비티"][doc["id"]] = doc

  return {category: list(docs.values()) for category, docs in candidates_by_category.items()}


def load_existing_places() -> list[dict]:
  """기존 place 전체(이름, 좌표)를 중복 판단용으로 조회한다."""
  with get_connection() as conn:
    with conn.cursor() as cur:
      cur.execute("SELECT name, lat, lng FROM place WHERE lat IS NOT NULL AND lng IS NOT NULL")
      columns = [desc[0] for desc in cur.description]
      return [dict(zip(columns, row)) for row in cur.fetchall()]


def is_within_andong(doc: dict) -> bool:
  """검색 반경(20km)이 이웃 시군까지 넘어갈 수 있어 주소로 한 번 더 확인한다."""
  address = doc.get("road_address_name") or doc.get("address_name") or ""
  return "안동시" in address


def is_lodging(doc: dict) -> bool:
  """숙박(펜션/민박/캠핑장 등)은 수집 대상에서 제외 확정된 카테고리다 (ssot.md 참고)."""
  return "숙박" in (doc.get("category_name") or "")


def is_delivery_only(doc: dict) -> bool:
  """배달 전문(매장 방문 불가)은 장소 탐방 앱 성격과 맞지 않아 제외한다."""
  return "배달" in (doc.get("category_name") or "")


def is_valid_activity_category(doc: dict) -> bool:
  """액티비티는 키워드 검색 특성상 오탐이 많아 category_name 접두사로 화이트리스트 검증한다."""
  category_name = doc.get("category_name") or ""
  return any(category_name.startswith(prefix) for prefix in ACTIVITY_CATEGORY_PREFIXES)


def is_duplicate_of_existing(doc: dict, existing_places: list[dict]) -> bool:
  """이름+좌표 기준으로 기존(TourAPI) 장소와 겹치는지 확인한다."""
  doc_lat = float(doc["y"])
  doc_lng = float(doc["x"])
  for place in existing_places:
    distance_m = haversine_m(place["lat"], place["lng"], doc_lat, doc_lng)
    if distance_m <= DEDUP_DISTANCE_M and is_same_place(doc["place_name"], place["name"]):
      return True
  return False


def build_new_place_candidates() -> dict[str, list[dict]]:
  """카카오 후보 수집 → 기존 장소 중복 제거 → Google Places 사진 보완까지 수행한다."""
  existing_places = load_existing_places()
  candidates_by_category = collect_candidates()

  results: dict[str, list[dict]] = {}
  for category, docs in candidates_by_category.items():
    original_count = len(docs)
    before = original_count
    step = [doc for doc in docs if is_within_andong(doc)]
    region_excluded = before - len(step)

    before = len(step)
    step = [doc for doc in step if not is_lodging(doc)]
    lodging_excluded = before - len(step)

    delivery_excluded = 0
    if category == "식당":
      before = len(step)
      step = [doc for doc in step if not is_delivery_only(doc)]
      delivery_excluded = before - len(step)

    activity_excluded = 0
    if category == "액티비티":
      before = len(step)
      step = [doc for doc in step if is_valid_activity_category(doc)]
      activity_excluded = before - len(step)

    before = len(step)
    step = [doc for doc in step if not is_franchise(doc)]
    franchise_excluded = before - len(step)

    new_docs = [doc for doc in step if not is_duplicate_of_existing(doc, existing_places)]
    duplicate_excluded = len(step) - len(new_docs)

    print(
      f"[{category}] 카카오 후보 {original_count}건 -> "
      f"지역 외 {region_excluded}건, 숙박 {lodging_excluded}건, "
      f"배달전문 {delivery_excluded}건, 액티비티 카테고리 부적합 {activity_excluded}건, "
      f"프랜차이즈 {franchise_excluded}건, 기존 중복 {duplicate_excluded}건 제외 "
      f"-> 최종 신규 {len(new_docs)}건"
    )

    enriched: list[dict] = []
    photo_found_count = 0
    for doc in new_docs:
      photo_match = find_place_photos(doc["place_name"], doc["x"], doc["y"])
      photo_urls = photo_match["photo_urls"] if photo_match else []
      if photo_match:
        photo_found_count += 1
      else:
        print(f"  사진 없음(장소 정보만 적재): {doc['place_name']}")
      enriched.append(
        {
          "kakao_id": doc["id"],
          "name": doc["place_name"],
          "category": category,
          "addr1": doc.get("road_address_name") or doc.get("address_name"),
          "lat": float(doc["y"]),
          "lng": float(doc["x"]),
          "tel": doc.get("phone") or None,
          "category_name": doc.get("category_name"),
          "photo_urls": photo_urls,
        }
      )
      time.sleep(0.1)

    print(f"[{category}] 최종 {len(enriched)}건 (사진 확보 {photo_found_count}건, 사진 없음 {len(enriched) - photo_found_count}건)")
    results[category] = enriched

  return results


def main() -> None:
  candidates = build_new_place_candidates()

  payload = {
    "fetched_at": datetime.now().isoformat(),
    "provider": "kakao+google",
    "items": candidates,
  }
  NEW_PLACES_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2))

  total = sum(len(docs) for docs in candidates.values())
  print(f"saved: {NEW_PLACES_PATH} (총 {total}건)")


if __name__ == "__main__":
  main()
