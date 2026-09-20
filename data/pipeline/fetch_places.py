import json
from datetime import datetime

import requests

from pipeline.config import get_tourapi_config
from pipeline.paths import TOURAPI_ROOT


def fetch_page(content_type_id: int, page_no: int) -> dict:
    config = get_tourapi_config()
    response = requests.get(
        f"{config.base_url}/areaBasedList2",
        params={
            "serviceKey": config.service_key,
            "MobileOS": config.mobile_os,
            "MobileApp": config.mobile_app,
            "_type": "json",
            "numOfRows": config.page_size,
            "pageNo": page_no,
            "arrange": "A",
            "contentTypeId": content_type_id,
            "lDongRegnCd": config.region_code,
            "lDongSignguCd": config.sigungu_code,
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def extract_items(payload: dict) -> list[dict]:
    body = payload.get("response", {}).get("body", {})
    items = body.get("items", {}).get("item", [])
    if isinstance(items, dict):
        return [items]
    return items


def fetch_all_places() -> dict:
    config = get_tourapi_config()
    results: dict[str, list[dict]] = {}

    for content_type_id in config.content_type_ids:
        page_no = 1
        all_items: list[dict] = []

        while True:
            payload = fetch_page(content_type_id, page_no)
            items = extract_items(payload)
            if not items:
                break

            all_items.extend(items)
            if len(items) < config.page_size:
                break
            page_no += 1

        results[str(content_type_id)] = all_items

    return {
        "fetched_at": datetime.now().isoformat(),
        "region_code": config.region_code,
        "sigungu_code": config.sigungu_code,
        "content_types": results,
    }


def main() -> None:
    payload = fetch_all_places()
    output_path = TOURAPI_ROOT / "places.json"
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"saved: {output_path}")


if __name__ == "__main__":
    main()
