import json

from pipeline.db import get_connection
from pipeline.paths import GOOGLE_ROOT


PLACE_HOURS_PATH = GOOGLE_ROOT / "place_hours.json"

UPSERT_SQL = """
INSERT INTO place_hours (place_id, open_day, open_time, close_day, close_time)
VALUES (%(place_id)s, %(open_day)s, %(open_time)s, %(close_day)s, %(close_time)s)
ON CONFLICT (place_id, open_day, open_time) DO UPDATE SET
    close_day = EXCLUDED.close_day,
    close_time = EXCLUDED.close_time;
"""


def _to_time(value: str) -> str:
    # Google "HHMM" -> "HH:MM:SS"
    return f"{value[0:2]}:{value[2:4]}:00"


def main() -> None:
    data = json.loads(PLACE_HOURS_PATH.read_text())["items"]

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT content_id, id FROM place")
            content_id_to_place_id = dict(cur.fetchall())

            matched = 0
            row_count = 0
            skipped = 0
            for content_id, entry in data.items():
                place_id = content_id_to_place_id.get(content_id)
                if place_id is None:
                    skipped += 1
                    continue
                matched += 1
                for period in entry["periods"]:
                    open_ = period.get("open")
                    close = period.get("close")
                    if open_ is None:
                        continue
                    cur.execute(
                        UPSERT_SQL,
                        {
                            "place_id": place_id,
                            "open_day": int(open_["day"]),
                            "open_time": _to_time(open_["time"]),
                            "close_day": int(close["day"]) if close else None,
                            "close_time": _to_time(close["time"]) if close else None,
                        },
                    )
                    row_count += 1

    print(f"장소 매칭: {matched}건, 삭제된(축제 등) content_id라 스킵: {skipped}건")
    print(f"place_hours upserted: {row_count}건")


if __name__ == "__main__":
    main()
