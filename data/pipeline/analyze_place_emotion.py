import asyncio
import sys
from pathlib import Path
from typing import Callable

from pipeline.db import get_connection

# ai/semantic_vector는 별도 패키지라 sys.path에 추가해야 import 가능
# (2026-07-23 결정: AI 코드는 data/pipeline이 아닌 별도 ai/ 폴더에 둠, decision-log 참고)
_AI_ROOT = Path(__file__).resolve().parents[2] / "ai"
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))

from semantic_vector.config import SemanticVectorConfig  # noqa: E402
from semantic_vector.models import PlaceImageInput  # noqa: E402
from semantic_vector.score_calculator import calculate_major_scores  # noqa: E402
from semantic_vector.vision_client import analyze_image_with_vision  # noqa: E402


# 7개 감성태그 (docs/ssot.md 확정 목록)
EMOTION_TAGS = ("relaxing", "lively", "romantic", "local", "photogenic", "traditional", "modern")

# 이 점수 이상이면 해당 태그가 "있다"고 보고 place_emotion_tag.count를 1 올린다.
# 온보딩 레이더 차트의 중립 기준선(0.5)과 동일한 기준을 사용.
TAG_PRESENT_THRESHOLD = 0.5

# 사진 URL 하나를 받아 7개 감성태그 각각 0.0~1.0 점수를 반환하는 함수.
AnalyzeImage = Callable[[str], dict[str, float]]


def stub_analyzer(image_url: str) -> dict[str, float]:
    raise NotImplementedError(
        "감성태그 분석 AI 모델이 아직 확정되지 않았습니다. "
        "김지광 담당 모델/프롬프트가 나오면 analyze_image에 실제 구현을 주입하세요."
    )


def build_vision_analyzer(config: SemanticVectorConfig | None = None) -> AnalyzeImage:
    """ai/semantic_vector의 GPT Vision 분석(35개 세부 태그 → 7개 대분류 평균)을 그대로 재사용한다.

    필요 조건 (ai/.env.example, ai/pyproject.toml 참고):
    - data/.env에 OPENAI_API_KEY, QDRANT_URL 필요 (Qdrant는 실제로 호출 안 하지만
      SemanticVectorConfig 필수 필드라 값이 있어야 하고, semantic_vector 패키지
      __init__.py가 qdrant_repository를 미리 import해서 qdrant-client 설치도 필요)
    - data/.venv에 openai, pydantic, pydantic-settings, qdrant-client 설치 필요
      (data/requirements.txt엔 일부러 안 넣음 — ai 쪽 SDK 의존성 분리 원칙, decision-log 참고)
    """
    resolved_config = config or SemanticVectorConfig()

    def analyze_image(image_url: str) -> dict[str, float]:
        input_data = PlaceImageInput(place_id="adhoc", image_url=image_url)
        response = asyncio.run(analyze_image_with_vision(input_data, config=resolved_config))
        major_scores = calculate_major_scores(response.detail_scores)
        return major_scores.model_dump()

    return analyze_image


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


def main(analyze_image: AnalyzeImage | None = None) -> None:
    # 인자 없이 호출하면 실제 AI 분석기를 사용 (지연 생성 — import만으로 API 키를 요구하지 않도록)
    resolved_analyze_image = analyze_image or build_vision_analyzer()

    with get_connection() as conn:
        with conn.cursor() as cur:
            places = fetch_unanalyzed_places(cur)

            tag_count = 0
            for place_id, image_url in places:
                scores = resolved_analyze_image(image_url)
                for tag in present_tags(scores):
                    cur.execute(UPSERT_EMOTION_TAG_SQL, {"place_id": place_id, "tag": tag})
                    tag_count += 1

    print(f"분석 대상 장소: {len(places)}건")
    print(f"place_emotion_tag upserted: {tag_count}건")


if __name__ == "__main__":
    main()
