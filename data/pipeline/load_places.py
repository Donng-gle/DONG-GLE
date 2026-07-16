import json
import re
from datetime import datetime

from pipeline.db import get_connection
from pipeline.paths import RAW_ROOT, TOURAPI_ROOT


# 쇼핑(38)은 PLACE.category enum(관광지/식당/카페/액티비티/문화공간/축제행사)에
# 아직 매핑 결정이 없어 적재 대상에서 제외한다. (팀 결정 후 milestone.md 갱신 필요)
CONTENT_TYPE_CATEGORY = {
    "12": "관광지",
    "14": "문화공간",
    "15": "축제행사",
    "28": "액티비티",
    "39": "식당",  # lclsSystm2 == FD05(카페/베이커리)면 카페로 재분류
}
SKIPPED_CONTENT_TYPES = {"38"}

HREF_PATTERN = re.compile(r'href="([^"]+)"')


def resolve_category(content_type_id: str, item: dict) -> str | None:
    category = CONTENT_TYPE_CATEGORY.get(content_type_id)
    if category == "식당" and item.get("lclsSystm2") == "FD05":
        return "카페"
    return category


def parse_float(value: str | None) -> float | None:
    if value in (None, ""):
        return None
    return float(value)


def parse_date(value: str | None) -> str | None:
    if value in (None, ""):
        return None
    return datetime.strptime(value, "%Y%m%d").strftime("%Y-%m-%d")


def parse_homepage(html: str | None) -> str | None:
    if not html:
        return None
    match = HREF_PATTERN.search(html)
    return match.group(1) if match else None


def load_raw() -> tuple[list[dict], dict, dict, dict, dict]:
    places_payload = json.loads((TOURAPI_ROOT / "places.json").read_text())
    all_items = [
        (content_type_id, item)
        for content_type_id, items in places_payload["content_types"].items()
        for item in items
    ]

    common = json.loads((TOURAPI_ROOT / "detail_common.json").read_text())["items"]
    images = json.loads((TOURAPI_ROOT / "detail_images.json").read_text())["items"]

    festival_dates: dict[str, dict] = {}
    festivals_path = TOURAPI_ROOT / "festival_dates.json"
    if festivals_path.exists():
        for entry in json.loads(festivals_path.read_text())["items"]:
            festival_dates[entry["contentid"]] = entry

    # TourAPI 음식점(39)은 tel이 거의 항상 비어 있어 카카오 로컬 API로 보완
    # (fetch_kakao_tel.py). 파일 없으면(카카오 키 미설정 등) 그냥 건너뜀.
    kakao_tel: dict[str, str] = {}
    kakao_tel_path = RAW_ROOT / "kakao" / "restaurant_tel.json"
    if kakao_tel_path.exists():
        for content_id, entry in json.loads(kakao_tel_path.read_text())["items"].items():
            kakao_tel[content_id] = entry["phone"]

    return all_items, common, images, festival_dates, kakao_tel


def build_place_row(
    content_type_id: str, item: dict, common: dict, festival_dates: dict, kakao_tel: dict
) -> dict | None:
    category = resolve_category(content_type_id, item)
    if category is None:
        return None

    content_id = item["contentid"]
    detail = common.get(content_id, {})
    festival = festival_dates.get(content_id, {})

    return {
        "content_id": content_id,
        "content_type_id": int(content_type_id),
        "category": category,
        "name": item["title"],
        "addr1": item.get("addr1") or None,
        "addr2": item.get("addr2") or None,
        "lat": parse_float(item.get("mapy")),
        "lng": parse_float(item.get("mapx")),
        "tel": item.get("tel") or kakao_tel.get(content_id) or None,
        "main_image_url": item.get("firstimage") or None,
        "overview": detail.get("overview") or None,
        "homepage": parse_homepage(detail.get("homepage")),
        "lcls_systm1": item.get("lclsSystm1") or None,
        "lcls_systm2": item.get("lclsSystm2") or None,
        "lcls_systm3": item.get("lclsSystm3") or None,
        "event_start_date": parse_date(festival.get("eventstartdate")),
        "event_end_date": parse_date(festival.get("eventenddate")),
    }


UPSERT_PLACE_SQL = """
INSERT INTO place (
    content_id, content_type_id, category, name, addr1, addr2, lat, lng, tel,
    main_image_url, overview, homepage, lcls_systm1, lcls_systm2, lcls_systm3,
    event_start_date, event_end_date, synced_at
) VALUES (
    %(content_id)s, %(content_type_id)s, %(category)s, %(name)s, %(addr1)s, %(addr2)s,
    %(lat)s, %(lng)s, %(tel)s, %(main_image_url)s, %(overview)s, %(homepage)s,
    %(lcls_systm1)s, %(lcls_systm2)s, %(lcls_systm3)s, %(event_start_date)s, %(event_end_date)s, NOW()
)
ON CONFLICT (content_id) DO UPDATE SET
    content_type_id = EXCLUDED.content_type_id,
    category = EXCLUDED.category,
    name = EXCLUDED.name,
    addr1 = EXCLUDED.addr1,
    addr2 = EXCLUDED.addr2,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    tel = EXCLUDED.tel,
    main_image_url = EXCLUDED.main_image_url,
    overview = EXCLUDED.overview,
    homepage = EXCLUDED.homepage,
    lcls_systm1 = EXCLUDED.lcls_systm1,
    lcls_systm2 = EXCLUDED.lcls_systm2,
    lcls_systm3 = EXCLUDED.lcls_systm3,
    event_start_date = EXCLUDED.event_start_date,
    event_end_date = EXCLUDED.event_end_date,
    synced_at = NOW()
RETURNING id;
"""

UPSERT_PLACE_IMAGE_SQL = """
INSERT INTO place_image (place_id, img_url, sort_order)
VALUES (%(place_id)s, %(img_url)s, %(sort_order)s)
ON CONFLICT (place_id, img_url) DO NOTHING;
"""


def main() -> None:
    all_items, common, images, festival_dates, kakao_tel = load_raw()

    skipped_types: dict[str, int] = {}
    place_rows = []
    for content_type_id, item in all_items:
        if content_type_id in SKIPPED_CONTENT_TYPES:
            skipped_types[content_type_id] = skipped_types.get(content_type_id, 0) + 1
            continue
        row = build_place_row(content_type_id, item, common, festival_dates, kakao_tel)
        if row is None:
            skipped_types[content_type_id] = skipped_types.get(content_type_id, 0) + 1
            continue
        place_rows.append(row)

    with get_connection() as conn:
        with conn.cursor() as cur:
            content_id_to_place_id: dict[str, int] = {}
            for row in place_rows:
                cur.execute(UPSERT_PLACE_SQL, row)
                content_id_to_place_id[row["content_id"]] = cur.fetchone()[0]

            image_count = 0
            for content_id, image_items in images.items():
                place_id = content_id_to_place_id.get(content_id)
                if place_id is None:
                    continue
                for sort_order, image_item in enumerate(image_items):
                    img_url = image_item.get("originimgurl")
                    if not img_url:
                        continue
                    cur.execute(
                        UPSERT_PLACE_IMAGE_SQL,
                        {"place_id": place_id, "img_url": img_url, "sort_order": sort_order},
                    )
                    image_count += 1

    print(f"place upserted: {len(place_rows)}건")
    for content_type_id, count in sorted(skipped_types.items()):
        print(f"  skipped content_type_id={content_type_id}: {count}건 (category 매핑 미정)")
    print(f"place_image upserted: {image_count}건")


if __name__ == "__main__":
    main()
