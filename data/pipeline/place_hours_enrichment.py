import json
import time
from datetime import datetime

import requests

from pipeline.config import get_google_config
from pipeline.paths import GOOGLE_ROOT, TOURAPI_ROOT
from pipeline.tel_enrichment import haversine_m, is_same_place, tourapi_coords


SEARCH_RADIUS_M = 300
# 축제(15)는 상시 운영 개념이 아니라 제외, 쇼핑(38)은 대부분 적재 자체가 제외 대상이라 제외
TARGET_CONTENT_TYPE_IDS = ("12", "14", "28", "39")
PLACE_HOURS_PATH = GOOGLE_ROOT / "place_hours.json"


def load_target_items() -> list[dict]:
    places_payload = json.loads((TOURAPI_ROOT / "places.json").read_text())
    return [
        item
        for content_type_id in TARGET_CONTENT_TYPE_IDS
        for item in places_payload["content_types"].get(content_type_id, [])
    ]


def _place_details(place_id: str) -> dict | None:
    config = get_google_config()
    response = requests.get(
        f"{config.base_url}/details/json",
        params={
            "place_id": place_id,
            "fields": "name,opening_hours,formatted_phone_number,international_phone_number",
            "language": "ko",
            "key": config.api_key,
        },
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("status") != "OK":
        return None
    return payload.get("result")


def find_place_hours(title: str, mapx: str, mapy: str) -> dict | None:
    lat, lng = tourapi_coords(mapx, mapy)
    config = get_google_config()
    response = requests.get(
        f"{config.base_url}/nearbysearch/json",
        params={
            "location": f"{lat},{lng}",
            "radius": SEARCH_RADIUS_M,
            "keyword": title,
            "language": "ko",
            "key": config.api_key,
        },
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("status") not in ("OK", "ZERO_RESULTS"):
        raise RuntimeError(f"Google Places API error: {payload.get('status')} ({payload.get('error_message')})")

    candidates: list[tuple[dict, float]] = []
    for place in payload.get("results", []):
        place_name = place.get("name", "")
        if not is_same_place(title, place_name):
            continue
        geometry = place.get("geometry", {}).get("location", {})
        place_lat = geometry.get("lat")
        place_lng = geometry.get("lng")
        if place_lat is None or place_lng is None:
            continue
        distance_m = haversine_m(lat, lng, place_lat, place_lng)
        candidates.append((place, distance_m))

    if not candidates:
        return None

    closest_place, distance_m = min(candidates, key=lambda item: item[1])
    details = _place_details(closest_place["place_id"])
    if not details:
        return None

    opening_hours = details.get("opening_hours")
    if not opening_hours or not opening_hours.get("periods"):
        return None

    return {
        "matched_name": details.get("name") or closest_place.get("name"),
        "distance_m": round(distance_m),
        "phone": details.get("formatted_phone_number") or details.get("international_phone_number"),
        # Google 요일 0=일요일, periods 하나가 하루의 한 영업 구간.
        # 같은 요일에 구간이 2개 이상이면 그 사이가 브레이크타임.
        "periods": opening_hours["periods"],
        "weekday_text": opening_hours.get("weekday_text"),
    }


def fetch_place_hours() -> dict:
    items = load_target_items()

    results: dict[str, dict] = {}
    for item in items:
        content_id = item["contentid"]
        title = item["title"]
        match = find_place_hours(title, item["mapx"], item["mapy"])
        if match:
            results[content_id] = match
            print(f"{title} -> {match['matched_name']} ({match['distance_m']}m) 영업시간 확보")
        else:
            print(f"{title} -> 매칭 실패 또는 영업시간 정보 없음")
        time.sleep(0.1)

    payload = {
        "fetched_at": datetime.now().isoformat(),
        "provider": "google",
        "items": results,
    }
    PLACE_HOURS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"saved: {PLACE_HOURS_PATH} ({len(results)}/{len(items)}건 매칭)")
    return payload
