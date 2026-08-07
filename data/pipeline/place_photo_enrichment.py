import json
import time
from datetime import datetime

import requests

from pipeline.config import get_google_config, get_image_proxy_base_url
from pipeline.paths import GOOGLE_ROOT
from pipeline.tel_enrichment import haversine_m, is_same_place, tourapi_coords


SEARCH_RADIUS_M = 300
MAX_PHOTOS_PER_PLACE = 5
PLACE_PHOTOS_PATH = GOOGLE_ROOT / "place_photos.json"


def _place_details(place_id: str) -> dict | None:
    config = get_google_config()
    response = requests.get(
        f"{config.base_url}/details/json",
        params={
            "place_id": place_id,
            "fields": "name,photos",
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


def find_place_photos(title: str, mapx: str, mapy: str) -> dict | None:
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

    photos = details.get("photos") or []
    if not photos:
        return None

    proxy_base_url = get_image_proxy_base_url()
    photo_urls = [
        f"{proxy_base_url}/images/proxy?ref={photo['photo_reference']}"
        for photo in photos[:MAX_PHOTOS_PER_PLACE]
    ]

    return {
        "matched_name": details.get("name") or closest_place.get("name"),
        "distance_m": round(distance_m),
        "photo_urls": photo_urls,
    }


def fetch_place_photos(items: list[dict]) -> dict:
    results: dict[str, dict] = {}
    for item in items:
        content_id = item["content_id"]
        title = item["name"]
        match = find_place_photos(title, str(item["lng"]), str(item["lat"]))
        if match:
            results[content_id] = match
            print(f"{title} -> {match['matched_name']} ({match['distance_m']}m) 사진 {len(match['photo_urls'])}장")
        else:
            print(f"{title} -> 매칭 실패 또는 사진 없음")
        time.sleep(0.1)

    payload = {
        "fetched_at": datetime.now().isoformat(),
        "provider": "google",
        "items": results,
    }
    PLACE_PHOTOS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"saved: {PLACE_PHOTOS_PATH} ({len(results)}/{len(items)}건 매칭)")
    return payload
