import json
import re

from pipeline.db import get_connection
from pipeline.paths import TOURAPI_ROOT


DETAIL_INTRO_PATH = TOURAPI_ROOT / "detail_intro_hours.json"

HOUR_FIELD = {
    "12": "usetime",
    "14": "usetimeculture",
    "28": "usetimeleports",
    "39": "opentimefood",
}

TIME_PATTERN = re.compile(r"(\d{1,2}):(\d{2})\s*~\s*(\d{1,2}):(\d{2})")
ALWAYS_OPEN_PATTERN = re.compile(r"^상시\s*개방$")

UPSERT_SQL = """
INSERT INTO place_hours (place_id, open_day, open_time, close_day, close_time)
VALUES (%(place_id)s, %(open_day)s, %(open_time)s, %(close_day)s, %(close_time)s)
ON CONFLICT (place_id, open_day, open_time) DO UPDATE SET
    close_day = EXCLUDED.close_day,
    close_time = EXCLUDED.close_time;
"""


def classify(raw: str) -> tuple[str, tuple[str, str, str, str] | None]:
    """반환: ("always_open" | "simple_range" | "skip", 시간 매치 결과)"""
    stripped = raw.strip()
    if not stripped:
        return "skip", None
    if ALWAYS_OPEN_PATTERN.match(stripped):
        return "always_open", None
    matches = TIME_PATTERN.findall(stripped)
    if len(matches) == 1 and len(stripped) < 40:
        return "simple_range", matches[0]
    return "skip", None


def main() -> None:
    data = json.loads(DETAIL_INTRO_PATH.read_text())["items"]

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT p.id, p.content_id FROM place p
                WHERE p.id NOT IN (SELECT DISTINCT place_id FROM place_hours)
                """
            )
            missing = cur.fetchall()

    always_open_count = 0
    simple_range_count = 0
    skipped_count = 0

    for place_id, content_id in missing:
        item = data.get(content_id)
        if not item:
            skipped_count += 1
            continue

        field = HOUR_FIELD.get(item["contenttypeid"])
        raw = item.get(field) if field else None
        kind, match = classify(raw or "")

        if kind == "skip":
            skipped_count += 1
            continue

        with get_connection() as conn:
            with conn.cursor() as cur:
                if kind == "always_open":
                    for day in range(7):
                        cur.execute(
                            UPSERT_SQL,
                            {
                                "place_id": place_id,
                                "open_day": day,
                                "open_time": "00:00:00",
                                "close_day": None,
                                "close_time": None,
                            },
                        )
                    always_open_count += 1
                elif kind == "simple_range":
                    oh, om, ch, cm = match
                    for day in range(7):
                        cur.execute(
                            UPSERT_SQL,
                            {
                                "place_id": place_id,
                                "open_day": day,
                                "open_time": f"{oh}:{om}:00",
                                "close_day": day,
                                "close_time": f"{ch}:{cm}:00",
                            },
                        )
                    simple_range_count += 1

    print(f"미보유 대상: {len(missing)}건")
    print(f"상시개방으로 채움: {always_open_count}건")
    print(f"단순 단일시간대로 채움: {simple_range_count}건")
    print(f"스킵(복잡한 텍스트/데이터 없음): {skipped_count}건")


if __name__ == "__main__":
    main()
