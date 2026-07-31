import json
import math
import re
import time
from datetime import datetime

import requests

from pipeline.config import get_google_config
from pipeline.paths import TOURAPI_ROOT, TEL_ROOT


SEARCH_RADIUS_M = 300
CONTENT_TYPE_ID = "39"  # 음식점(식당/카페)만 대상
RESTAURANT_TEL_PATH = TEL_ROOT / "restaurant_tel.json"

NAME_CHARS_PATTERN = re.compile(r"[^0-9a-zA-Z가-힣]")


def normalize_name(name: str) -> str:
    return NAME_CHARS_PATTERN.sub("", name or "").lower()


def is_same_place(title: str, place_name: str) -> bool:
    # 좌표가 가까워도 다른 업체(옆 건물, 폐업 후 다른 업체 입점 등)일 수 있어
    # 거리만으로 신뢰하지 않고 이름 포함 관계로 한 번 더 검증한다.
    normalized_title = normalize_name(title)
    normalized_place = normalize_name(place_name)
    return normalized_title in normalized_place or normalized_place in normalized_title


def to_wgs84(coord: str) -> float:
    value = float(coord)
    if abs(value) > 1000:
        return value / 10_000_000
    return value


def tourapi_coords(mapx: str, mapy: str) -> tuple[float, float]:
    return to_wgs84(mapy), to_wgs84(mapx)


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius_m = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * radius_m * math.asin(math.sqrt(a))


def load_restaurant_items_without_tel() -> list[dict]:
    places_payload = json.loads((TOURAPI_ROOT / "places.json").read_text())
    return [
        item
        for item in places_payload["content_types"].get(CONTENT_TYPE_ID, [])
        if not item.get("tel")
    ]


def _google_place_details(place_id: str) -> dict | None:
    config = get_google_config()
    response = requests.get(
        f"{config.base_url}/details/json",
        params={
            "place_id": place_id,
            "fields": "formatted_phone_number,international_phone_number,name",
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


def find_phone(title: str, mapx: str, mapy: str) -> dict | None:
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
    details = _google_place_details(closest_place["place_id"])
    if not details:
        return None

    phone = details.get("formatted_phone_number") or details.get("international_phone_number")
    if not phone:
        return None

    return {
        "phone": phone,
        "matched_name": details.get("name") or closest_place.get("name"),
        "distance_m": round(distance_m),
    }


def fetch_restaurant_tel() -> dict:
    restaurant_items = load_restaurant_items_without_tel()

    results: dict[str, dict] = {}
    for item in restaurant_items:
        content_id = item["contentid"]
        title = item["title"]
        match = find_phone(title, item["mapx"], item["mapy"])
        if match:
            results[content_id] = match
            print(f"{title} -> {match['matched_name']} ({match['distance_m']}m) tel={match['phone']}")
        else:
            print(f"{title} -> 매칭 실패")
        time.sleep(0.1)

    payload = {
        "fetched_at": datetime.now().isoformat(),
        "provider": "google",
        "items": results,
    }
    TEL_ROOT.mkdir(parents=True, exist_ok=True)
    RESTAURANT_TEL_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"saved: {RESTAURANT_TEL_PATH} ({len(results)}/{len(restaurant_items)}건 매칭)")
    return payload


def load_restaurant_tel() -> dict[str, str]:
    if not RESTAURANT_TEL_PATH.exists():
        return {}

    return {
        content_id: entry["phone"]
        for content_id, entry in json.loads(RESTAURANT_TEL_PATH.read_text())["items"].items()
    }
