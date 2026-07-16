import json
import re
from datetime import datetime

import requests

from pipeline.config import get_kakao_config
from pipeline.paths import TOURAPI_ROOT, RAW_ROOT


KAKAO_ROOT = RAW_ROOT / "kakao"
KAKAO_ROOT.mkdir(parents=True, exist_ok=True)

SEARCH_RADIUS_M = 300
CONTENT_TYPE_ID = "39"  # 음식점(식당/카페)만 대상

NAME_CHARS_PATTERN = re.compile(r"[^0-9a-zA-Z가-힣]")


def normalize_name(name: str) -> str:
    return NAME_CHARS_PATTERN.sub("", name or "").lower()


def is_same_place(title: str, place_name: str) -> bool:
    # 좌표가 가까워도 다른 업체(옆 건물, 폐업 후 다른 업체 입점 등)일 수 있어
    # 거리만으로 신뢰하지 않고 이름 포함 관계로 한 번 더 검증한다.
    normalized_title = normalize_name(title)
    normalized_place = normalize_name(place_name)
    return normalized_title in normalized_place or normalized_place in normalized_title


def search_keyword(query: str, x: str, y: str) -> list[dict]:
    config = get_kakao_config()
    response = requests.get(
        f"{config.base_url}/search/keyword.json",
        headers={"Authorization": f"KakaoAK {config.rest_api_key}"},
        params={"query": query, "x": x, "y": y, "radius": SEARCH_RADIUS_M},
        timeout=30,
    )
    response.raise_for_status()
    return response.json().get("documents", [])


def find_phone(title: str, mapx: str, mapy: str) -> dict | None:
    documents = search_keyword(title, mapx, mapy)
    candidates = [d for d in documents if d.get("phone") and is_same_place(title, d.get("place_name", ""))]
    if not candidates:
        return None

    closest = min(candidates, key=lambda d: int(d.get("distance") or 10**9))
    return {
        "phone": closest["phone"],
        "matched_name": closest.get("place_name"),
        "distance_m": closest.get("distance"),
    }


def main() -> None:
    places_payload = json.loads((TOURAPI_ROOT / "places.json").read_text())
    restaurant_items = [
        item
        for item in places_payload["content_types"].get(CONTENT_TYPE_ID, [])
        if not item.get("tel")
    ]

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

    output_path = KAKAO_ROOT / "restaurant_tel.json"
    output_path.write_text(
        json.dumps(
            {"fetched_at": datetime.now().isoformat(), "items": results},
            ensure_ascii=False,
            indent=2,
        )
    )
    print(f"saved: {output_path} ({len(results)}/{len(restaurant_items)}건 매칭)")


if __name__ == "__main__":
    main()
