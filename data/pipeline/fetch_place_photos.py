from pipeline.db import get_connection
from pipeline.place_photo_enrichment import fetch_place_photos


def load_places_without_photos() -> list[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT content_id, name, lat, lng
                FROM place
                WHERE main_image_url IS NULL
                  AND id NOT IN (SELECT DISTINCT place_id FROM place_image)
                ORDER BY category, name
                """
            )
            columns = [desc[0] for desc in cur.description]
            return [dict(zip(columns, row)) for row in cur.fetchall()]


def main() -> None:
    items = load_places_without_photos()
    print(f"사진 없는 장소 {len(items)}건 대상으로 시작")
    fetch_place_photos(items)


if __name__ == "__main__":
    main()
