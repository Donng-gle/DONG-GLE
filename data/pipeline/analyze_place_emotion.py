from typing import Callable

from pipeline.db import get_connection


# 7개 감성태그 (docs/ssot.md 확정 목록)
EMOTION_TAGS = ("relaxing", "lively", "romantic", "local", "photogenic", "traditional", "modern")

# 이 점수 이상이면 해당 태그가 "있다"고 보고 place_emotion_tag.count를 1 올린다.
# 온보딩 레이더 차트의 중립 기준선(0.5)과 동일한 기준을 사용.
TAG_PRESENT_THRESHOLD = 0.5

# 사진 URL 하나를 받아 7개 감성태그 각각 0.0~1.0 점수를 반환하는 함수.
# 실제 AI 모델 선택과 판단 기준/프롬프트 설계는 김지광(알고리즘+LLM) 담당.
# 이 함수만 실제 구현으로 교체하면 나머지 파이프라인(DB 조회/적재)은 그대로 동작한다.
AnalyzeImage = Callable[[str], dict[str, float]]


def stub_analyzer(image_url: str) -> dict[str, float]:
    raise NotImplementedError(
        "감성태그 분석 AI 모델이 아직 확정되지 않았습니다. "
        "김지광 담당 모델/프롬프트가 나오면 analyze_image에 실제 구현을 주입하세요."
    )


UPSERT_EMOTION_TAG_SQL = """
INSERT INTO place_emotion_tag (place_id, tag, count)
VALUES (%(place_id)s, %(tag)s, 1)
ON CONFLICT (place_id, tag) DO UPDATE SET count = place_emotion_tag.count + 1;
"""


def fetch_unanalyzed_places(cur) -> list[tuple[int, str]]:
    # 이미 place_emotion_tag가 있는 장소는 재실행 시 다시 세지 않는다
    # (재실행해도 중복 카운트 안 되도록, load_places.py와 동일한 안전 원칙).
    # 한계: 분석 결과 7개 태그가 전부 threshold 미만이면 행이 하나도 안 생겨서
    # "미분석"과 구분이 안 되고, 재실행할 때마다 계속 재분석 대상에 잡힌다.
    # 실제로 자주 발생하면 place에 분석 완료 여부(예: emotion_analyzed_at) 컬럼 추가 필요.
    cur.execute(
        """
        SELECT id, main_image_url FROM place
        WHERE main_image_url IS NOT NULL
          AND id NOT IN (SELECT DISTINCT place_id FROM place_emotion_tag)
        """
    )
    return cur.fetchall()


def present_tags(scores: dict[str, float]) -> list[str]:
    return [tag for tag in EMOTION_TAGS if scores.get(tag, 0.0) >= TAG_PRESENT_THRESHOLD]


def main(analyze_image: AnalyzeImage = stub_analyzer) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            places = fetch_unanalyzed_places(cur)

            tag_count = 0
            for place_id, image_url in places:
                scores = analyze_image(image_url)
                for tag in present_tags(scores):
                    cur.execute(UPSERT_EMOTION_TAG_SQL, {"place_id": place_id, "tag": tag})
                    tag_count += 1

    print(f"분석 대상 장소: {len(places)}건")
    print(f"place_emotion_tag upserted: {tag_count}건")


if __name__ == "__main__":
    main()
