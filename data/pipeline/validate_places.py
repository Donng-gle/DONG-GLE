import json

from pipeline.paths import TOURAPI_ROOT


REQUIRED_FIELDS = ("contentid", "title", "mapx", "mapy")


def validate_item(item: dict) -> list[str]:
    errors: list[str] = []
    for field in REQUIRED_FIELDS:
        value = item.get(field)
        if value in (None, ""):
            errors.append(field)
    return errors


def main() -> None:
    input_path = TOURAPI_ROOT / "places.json"
    if not input_path.exists():
        raise FileNotFoundError(f"missing raw file: {input_path}")

    payload = json.loads(input_path.read_text())
    content_types = payload.get("content_types", {})

    total_count = 0
    invalid_count = 0

    for content_type_id, items in content_types.items():
        for item in items:
            total_count += 1
            errors = validate_item(item)
            if errors:
                invalid_count += 1
                print(f"[invalid] type={content_type_id} contentid={item.get('contentid')} missing={','.join(errors)}")

    print(f"validated: total={total_count}, invalid={invalid_count}")


if __name__ == "__main__":
    main()
