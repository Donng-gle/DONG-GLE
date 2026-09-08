"""fetch_kakao_places.py가 만든 후보(raw/kakao/new_places.json)를 place/place_image에 적재한다.

TourAPI content_id와 안 겹치도록 "kakao-{카카오 place id}" 형태의 합성 content_id를 쓴다.
기본은 --dry-run(후보 목록만 출력)이고, --execute를 붙여야 실제로 DB에 반영한다.

사용 예:
  python -m pipeline.load_kakao_places            # dry-run
  python -m pipeline.load_kakao_places --execute   # 실제 반영
"""

from __future__ import annotations

import argparse
import json

from pipeline.db import get_connection
from pipeline.paths import KAKAO_ROOT

NEW_PLACES_PATH = KAKAO_ROOT / "new_places.json"

UPSERT_PLACE_SQL = """
INSERT INTO place (
    content_id, content_type_id, category, name, addr1, lat, lng, tel,
    main_image_url, synced_at
) VALUES (
    %(content_id)s, %(content_type_id)s, %(category)s, %(name)s, %(addr1)s,
    %(lat)s, %(lng)s, %(tel)s, %(main_image_url)s, NOW()
)
ON CONFLICT (content_id) DO UPDATE SET
    category = EXCLUDED.category,
    name = EXCLUDED.name,
    addr1 = EXCLUDED.addr1,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    tel = EXCLUDED.tel,
    main_image_url = EXCLUDED.main_image_url,
    synced_at = NOW()
RETURNING id;
"""

UPSERT_PLACE_IMAGE_SQL = """
INSERT INTO place_image (place_id, img_url, sort_order)
VALUES (%(place_id)s, %(img_url)s, %(sort_order)s)
ON CONFLICT (place_id, img_url) DO NOTHING;
"""

# content_type_id는 TourAPI 체계(12/14/15/28/38/39)를 그대로 흉내내 기존 코드와 호환되게 맞춘다.
# 카카오 출처 장소는 lcls_systm1/2/3(TourAPI 전용 분류)이 없어 NULL로 남는다.
CATEGORY_CONTENT_TYPE_ID = {
  "카페": 39,
  "식당": 39,
  "액티비티": 28,
}


def build_place_row(category: str, item: dict) -> dict:
  return {
    "content_id": f"kakao-{item['kakao_id']}",
    "content_type_id": CATEGORY_CONTENT_TYPE_ID[category],
    "category": category,
    "name": item["name"],
    "addr1": item.get("addr1"),
    "lat": item["lat"],
    "lng": item["lng"],
    "tel": item.get("tel"),
    "main_image_url": item["photo_urls"][0],
  }


def load_candidates() -> dict[str, list[dict]]:
  if not NEW_PLACES_PATH.exists():
    raise FileNotFoundError(
      f"{NEW_PLACES_PATH} 없음 — 먼저 python -m pipeline.fetch_kakao_places 실행 필요"
    )
  return json.loads(NEW_PLACES_PATH.read_text())["items"]


def save_kakao_places(candidates: dict[str, list[dict]]) -> tuple[int, int]:
  place_count = 0
  image_count = 0

  with get_connection() as conn:
    with conn.cursor() as cur:
      for category, items in candidates.items():
        for item in items:
          row = build_place_row(category, item)
          cur.execute(UPSERT_PLACE_SQL, row)
          place_id = cur.fetchone()[0]
          place_count += 1

          for sort_order, img_url in enumerate(item["photo_urls"]):
            cur.execute(
              UPSERT_PLACE_IMAGE_SQL,
              {"place_id": place_id, "img_url": img_url, "sort_order": sort_order},
            )
            image_count += 1

  return place_count, image_count


def main() -> None:
  parser = argparse.ArgumentParser(description="카카오로 발굴한 신규 장소를 place에 적재")
  parser.add_argument("--execute", action="store_true", help="실제로 DB에 반영한다. 없으면 dry-run.")
  args = parser.parse_args()

  candidates = load_candidates()
  total = sum(len(items) for items in candidates.values())
  print(f"적재 대상: 총 {total}건")
  for category, items in candidates.items():
    print(f"  {category}: {len(items)}건")
    for item in items:
      print(f"    - {item['name']} ({item.get('addr1') or '주소 없음'}) 사진 {len(item['photo_urls'])}장")

  if not args.execute:
    print("\n--dry-run 모드입니다. 실제 반영하려면 --execute를 붙여 실행하세요.")
    return

  place_count, image_count = save_kakao_places(candidates)
  print(f"\nplace upserted: {place_count}건")
  print(f"place_image upserted: {image_count}건")


if __name__ == "__main__":
  main()
