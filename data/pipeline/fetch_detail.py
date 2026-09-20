import argparse
import json
import time
from datetime import datetime

import requests

from pipeline.config import get_tourapi_config
from pipeline.paths import TOURAPI_ROOT


def _get(endpoint: str, params: dict, retries: int = 3) -> dict:
    config = get_tourapi_config()
    for attempt in range(retries):
        try:
            response = requests.get(
                f"{config.base_url}/{endpoint}",
                params={
                    "serviceKey": config.service_key,
                    "MobileOS": config.mobile_os,
                    "MobileApp": config.mobile_app,
                    "_type": "json",
                    **params,
                },
                timeout=30,
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout:
            if attempt < retries - 1:
                print(f"  timeout, retrying ({attempt + 1}/{retries})...")
                time.sleep(2 ** attempt)
            else:
                raise


def _extract_items(payload: dict) -> list[dict]:
    body = payload.get("response", {}).get("body", {})
    items = body.get("items")
    if not items or isinstance(items, str):
        return []
    item = items.get("item", [])
    if isinstance(item, dict):
        return [item]
    return item or []


def fetch_common(content_id: str) -> dict | None:
    payload = _get("detailCommon2", {"contentId": content_id, "numOfRows": 1, "pageNo": 1})
    items = _extract_items(payload)
    return items[0] if items else None


def fetch_images(content_id: str) -> list[dict]:
    payload = _get("detailImage2", {"contentId": content_id, "numOfRows": 10, "pageNo": 1})
    return _extract_items(payload)


def fetch_intro(content_id: str, content_type_id: str) -> dict | None:
    payload = _get(
        "detailIntro2",
        {"contentId": content_id, "contentTypeId": content_type_id, "numOfRows": 1, "pageNo": 1},
    )
    items = _extract_items(payload)
    return items[0] if items else None


def fetch_festivals(all_items: list[dict]) -> list[dict]:
    # searchFestival2's areaCode/sigunguCode use a different code system than
    # areaBasedList2's lDongRegnCd/lDongSignguCd (confirmed via detailCommon2:
    # 안동 festivals have areacode=35/sigungucode=11, not 47/170), so area
    # search always returned 0 rows. We already know the festival content_ids
    # from places.json, so fetch event dates directly via detailIntro2 instead.
    festival_ids = [item["contentid"] for item in all_items if item.get("contenttypeid") == "15"]
    results = []
    for content_id in festival_ids:
        intro = fetch_intro(content_id, "15")
        if intro:
            results.append(intro)
        print(f"festival {content_id}: {'ok' if intro else 'empty'}")
        time.sleep(0.1)
    return results


ALL_STEPS = ["common", "images", "festivals"]


def run_common(all_items: list[dict]) -> None:
    common_results: dict[str, dict] = {}
    for item in all_items:
        content_id = item.get("contentid")
        if not content_id:
            continue
        result = fetch_common(content_id)
        if result:
            common_results[content_id] = result
        print(f"common {content_id}: {'ok' if result else 'empty'}")
        time.sleep(0.1)

    (TOURAPI_ROOT / "detail_common.json").write_text(
        json.dumps(
            {"fetched_at": datetime.now().isoformat(), "items": common_results},
            ensure_ascii=False,
            indent=2,
        )
    )
    print(f"saved: detail_common.json ({len(common_results)}건)")


def run_images(all_items: list[dict]) -> None:
    no_image_ids = [
        item["contentid"]
        for item in all_items
        if not item.get("firstimage") and item.get("contentid")
    ]
    image_results: dict[str, list[dict]] = {}
    for content_id in no_image_ids:
        images = fetch_images(content_id)
        if images:
            image_results[content_id] = images
        print(f"image {content_id}: {len(images)}건")
        time.sleep(0.1)

    (TOURAPI_ROOT / "detail_images.json").write_text(
        json.dumps(
            {"fetched_at": datetime.now().isoformat(), "items": image_results},
            ensure_ascii=False,
            indent=2,
        )
    )
    print(f"saved: detail_images.json ({len(image_results)}건)")


def run_festivals(all_items: list[dict]) -> None:
    festivals = fetch_festivals(all_items)
    (TOURAPI_ROOT / "festival_dates.json").write_text(
        json.dumps(
            {"fetched_at": datetime.now().isoformat(), "items": festivals},
            ensure_ascii=False,
            indent=2,
        )
    )
    print(f"saved: festival_dates.json ({len(festivals)}건)")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "steps",
        nargs="*",
        choices=ALL_STEPS,
        default=ALL_STEPS,
        help="실행할 단계 (기본값: 전체). 예: images festivals",
    )
    args = parser.parse_args()
    steps = args.steps

    places_path = TOURAPI_ROOT / "places.json"
    if not places_path.exists():
        raise FileNotFoundError(f"먼저 fetch_places.py를 실행하세요: {places_path}")

    places_payload = json.loads(places_path.read_text())
    all_items = [
        item
        for items in places_payload.get("content_types", {}).values()
        for item in items
    ]

    if "common" in steps:
        run_common(all_items)
    if "images" in steps:
        run_images(all_items)
    if "festivals" in steps:
        run_festivals(all_items)


if __name__ == "__main__":
    main()
