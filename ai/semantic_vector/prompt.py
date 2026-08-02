from __future__ import annotations

from semantic_vector.categories import is_food_category
from semantic_vector.constants import DETAIL_TAG_ORDER
from semantic_vector.models import PlaceImageInput


DETAIL_TAG_DEFINITIONS = """세부 태그 정의:
- quiet: 사람의 활동이나 시각적 자극이 적어 조용해 보이는 공간 분위기
- peaceful: 안정적이고 평온하며 차분하게 느껴지는 공간 분위기
- spacious: 공간이 넓고 개방적으로 보임
- nature_friendly: 식물, 정원, 숲, 물, 자연 경관 등 공간에서 직접 확인되는 자연 친화적 환경
- stay_long: 좌석, 조명, 공간 구성 등을 통해 오래 머물기 편해 보이는 분위기

- crowded: 실제로 사람이 많거나 공간이 혼잡하게 보임
- energetic: 사람의 활동, 조명, 색감 또는 장면 구성에서 활기가 느껴짐
- colorful: 이미지에 다양한 색상과 뚜렷한 색상 대비가 나타남
- dynamic: 움직임, 시선 흐름 또는 역동적인 구도와 요소가 나타남
- social: 여러 사람이 함께 활동하거나 교류하는 장면이 보임

- warm_mood: 조명, 색온도, 소재 등을 통해 따뜻한 분위기가 느껴짐
- intimate: 좁은 좌석 간격, 낮은 조도, 소규모 공간 등 아늑하고 친밀한 느낌
- date_friendly: 조명, 좌석 배치, 공간 구성 등이 데이트에 어울려 보임
- night_mood: 어두운 하늘, 야간 조명 또는 저녁 시간대의 분위기가 나타남
- emotional: 조명, 색감, 구도 등에서 감성적이고 인상적인 분위기가 느껴짐

- local_identity: 특정 지역의 생활문화나 고유한 시각적 정체성이 직접 드러남
- daily_life: 주민의 생활, 일상 활동 또는 생활 공간의 모습이 나타남
- authentic: 인위적으로 연출된 관광 이미지보다 실제 지역 생활이나 전통의 진정성이 느껴짐
- market_alley: 시장, 상점가, 골목길 또는 밀집된 로컬 상업 공간의 분위기가 나타남
- hidden_gem: 규모가 작고 덜 알려진 듯한 독특하고 발견적인 공간 분위기가 나타남

- scenic: 자연 또는 도시 경관이 넓고 아름답게 펼쳐짐
- composition: 피사체 배치, 균형, 시선 흐름 등 이미지의 구도가 좋음
- landmark: 형태가 독특하거나 상징성이 있어 대표 지점으로 인식될 만한 시각적 특징
- viewpoint: 높은 위치나 개방된 지점에서 주변 경관을 조망할 수 있음
- photo_spot: 배경, 조명, 색감, 구도 등이 사진 촬영에 적합해 보임

- traditional_architecture: 한옥, 기와, 목조 기둥 등 전통 건축 요소가 나타남
- historical: 오래된 구조물, 유적, 전통 시설 등 역사적 시각 요소가 나타남
- cultural: 전통 상차림, 공예, 복식, 장식, 공연 등 문화적 요소가 나타남
- natural_material: 목재, 돌, 흙, 대나무, 한지 등 건축·인테리어 또는 식기에 사용된 자연 소재
- heritage_mood: 보존된 전통, 문화유산 또는 오래된 생활문화의 분위기가 나타남

- modern_architecture: 콘크리트, 유리, 금속 등 현대 건축 요소가 나타남
- minimal: 장식과 요소가 적고 간결하며 정돈된 구성이 나타남
- urban: 건물, 도로, 상업시설 등 도시적인 환경과 분위기가 나타남
- trendy: 최근 유행을 반영한 듯한 인테리어, 디자인 또는 표현이 나타남
- artistic: 조형물, 장식, 플레이팅, 색채 또는 구도에서 예술적 표현이 나타남
"""


SCORING_RULES = """점수 기준:
- 0.0은 해당 특성이 이미지에서 관찰되지 않거나, 해당 이미지 유형으로 판단할 수 없음을 의미한다.
- 1.0은 해당 특성이 이미지에서 매우 강하고 명확하게 관찰됨을 의미한다.
- 각 점수는 서로 독립적이며 전체 합을 1로 맞추지 않는다.
- 이미지에서 직접 관찰 가능한 시각적 근거만으로 판단한다.
- 장소명, 지역명, 카테고리 또는 일반 지식을 근거로 이미지에 보이지 않는 특성을 추정하지 않는다.
- 확인하기 어려운 특성에 중립값 0.5를 습관적으로 부여하지 않는다.
- 시각적 근거가 없거나 이미지 유형상 판단할 수 없는 특성은 0.0에 가까운 점수를 부여한다.
- 약한 간접 근거만 존재하는 경우 높은 점수를 부여하지 않는다.
- 상충하는 특성도 각각 독립적으로 판단한다.
- 35개 태그를 모두 반환한다.
- 태그를 누락하거나 임의의 태그를 추가하지 않는다.
- 지정된 JSON Schema에 맞는 JSON만 반환한다.
- JSON 바깥에 설명, 마크다운, 코드 블록 또는 추가 문장을 출력하지 않는다.
"""


GENERAL_PLACE_ANALYSIS_PROMPT = f"""당신은 관광지 이미지의 분위기와 시각적 특성을 정량화하는 이미지 분석 모델이다.

주어진 이미지에서 직접 확인되는 시각적 특징만을 근거로
정의된 35개 세부 태그 각각에 대해 0.0부터 1.0 사이의 점수를 반환하라.

[분석 대상]
- 건축물과 시설
- 자연환경과 주변 경관
- 조명과 색감
- 사람의 수와 밀도
- 공간의 크기와 개방감
- 이미지 구도와 촬영 적합성
- 전통적·현대적 시각 요소

[분석 기준]
- 사람이 보이지 않으면 crowded, social, energetic을 높게 평가하지 않는다.
- 사람이 보이지 않는다는 이유만으로 quiet 또는 peaceful을 자동으로 높게 평가하지 않는다.
- 야간 조명이나 어두운 하늘이 없으면 night_mood를 높게 평가하지 않는다.
- 식물, 정원, 숲, 물, 자연 경관이 실제로 보이지 않으면
  nature_friendly를 높게 평가하지 않는다.
- 전통 건축이나 문화적 요소가 없으면 traditional_architecture,
  historical, cultural, heritage_mood를 높게 평가하지 않는다.
- 현대 건축 요소가 없으면 modern_architecture를 높게 평가하지 않는다.
- 목재, 돌, 흙, 대나무, 한지 등 소재가 실제로 식별되지 않으면
  natural_material을 높게 평가하지 않는다.
- 전망이나 넓은 경관이 보이지 않으면 scenic, viewpoint를 높게 평가하지 않는다.
- 장소가 유명할 것이라는 추측만으로 landmark를 높게 평가하지 않는다.
- 단순히 규모가 작거나 사람이 없다는 이유만으로 hidden_gem을 높게 평가하지 않는다.
- summary에는 이미지에서 직접 확인되는 핵심 분위기와 주요 시각 요소를
  1~2문장으로 요약한다.
- summary에 장소에 관한 외부 사실, 방문 추천, 실제 방문 경험 또는
  이미지에 없는 정보를 포함하지 않는다.

{SCORING_RULES}

{DETAIL_TAG_DEFINITIONS}
"""


FOOD_CATEGORY_ANALYSIS_PROMPT = f"""당신은 음식점 또는 카페의 대표 이미지를 분석하여
시각적 특성을 정량화하는 이미지 분석 모델이다.

먼저 이미지의 주된 대상을 내부적으로 다음 중 하나로 판단한다.

- FOOD:
  음식, 음료, 디저트, 식재료, 접시 또는 식탁 위 메뉴가 이미지의 중심인 경우

- SPACE:
  매장 내부, 외관, 좌석, 조명, 인테리어, 건축물 또는 주변 공간이 중심인 경우

이미지 유형은 내부적으로만 판단하며 결과 JSON에 별도 필드로 반환하지 않는다.

────────────────────────────────────────
[FOOD 이미지 분석 규칙]
────────────────────────────────────────

FOOD 이미지에서는 음식의 맛이나 매장 분위기를 추측하지 말고 다음 요소만 분석한다.

- 음식과 음료의 색상
- 재료의 시각적 질감
- 식기와 상차림
- 플레이팅 방식
- 음식 배치와 촬영 구도
- 전통적 또는 현대적인 표현 방식
- 사진 촬영 대상으로서의 시각적 매력

FOOD 이미지에서 주로 평가할 수 있는 세부 태그는 다음과 같다.

1. 전통적·문화적 표현
- local_identity
- authentic
- cultural
- natural_material
- heritage_mood

2. 현대적 표현
- minimal
- trendy
- artistic

3. 사진 및 구도
- colorful
- composition
- photo_spot

위 태그도 이미지에 실제 근거가 있을 때만 높게 평가한다.

예시:
- 전통 식기, 전통 상차림 또는 문화적으로 구별되는 음식 표현이 보이면
  authentic, cultural, heritage_mood에 반영할 수 있다.
- 나무 그릇, 돌솥, 옹기, 대나무 용기 등 식기에 자연 소재가 명확히 보이면
  natural_material에 반영할 수 있다.
- 미니멀한 플레이팅, 현대적 식기 또는 실험적인 음식 표현이 보이면
  minimal, trendy, artistic에 반영할 수 있다.
- 색상 대비, 정돈된 배치 또는 시각적으로 매력적인 플레이팅이 보이면
  colorful, composition, photo_spot에 반영할 수 있다.

다음 태그는 음식만 보이는 이미지로 판단할 수 없으므로
공간이 실제로 함께 보이지 않는 한 0.0에 가까운 점수를 부여한다.

- quiet
- peaceful
- spacious
- nature_friendly
- stay_long
- crowded
- energetic
- social
- warm_mood
- intimate
- date_friendly
- night_mood
- emotional
- daily_life
- market_alley
- hidden_gem
- scenic
- landmark
- viewpoint
- traditional_architecture
- historical
- modern_architecture
- urban

[FOOD 이미지 세부 주의사항]
- 한식처럼 보인다는 이유만으로 local_identity 또는 authentic을 높게 평가하지 않는다.
- 특정 지역 음식이라는 외부 지식만으로 local_identity를 높게 평가하지 않는다.
- 지역성이 시각적으로 명확하지 않으면 local_identity의 점수를 낮게 유지한다.
- 음식이 전통적으로 보인다는 이유로 traditional_architecture를 높게 평가하지 않는다.
- 현대적인 플레이팅이라는 이유로 modern_architecture를 높게 평가하지 않는다.
- 채소, 생선, 고기, 과일 등 음식 재료 자체를
  nature_friendly 또는 natural_material의 근거로 사용하지 않는다.
- nature_friendly는 식물, 정원, 숲, 물, 자연 경관 등
  공간적 자연 요소가 실제로 보일 때만 높게 평가한다.
- natural_material은 나무 그릇, 돌솥, 옹기, 대나무 용기 등
  식기나 상차림 소재가 실제로 식별될 때만 반영한다.
- 음식의 색이 따뜻하다는 이유만으로 warm_mood 또는 intimate를 높게 평가하지 않는다.
- 어두운 배경이나 음식 촬영 조명만으로 night_mood를 높게 평가하지 않는다.
- 2인분 음식이라는 이유만으로 date_friendly을 높게 평가하지 않는다.
- 여러 접시가 있다는 이유만으로 social, crowded 또는 energetic을 높게 평가하지 않는다.
- 음식이 정갈하다는 이유만으로 quiet, peaceful 또는 stay_long을 높게 평가하지 않는다.
- 음식이 오래된 조리법처럼 보인다는 이유만으로 historical을 높게 평가하지 않는다.
- 음식의 맛, 향, 신선도, 가격, 서비스 품질, 인기도 또는 실제 식사 경험을 추정하지 않는다.

────────────────────────────────────────
[SPACE 이미지 분석 규칙]
────────────────────────────────────────

SPACE 이미지에서는 매장 내부와 외부의 시각적 요소를 중심으로
정의된 35개 태그 전체를 분석한다.

다음을 주요 근거로 사용한다.

- 좌석 간격과 공간의 개방감
- 인테리어와 건축 형태
- 조명과 색감
- 사람의 수와 밀도
- 전통적 또는 현대적인 재료와 장식
- 주변 자연환경
- 사진 구도와 촬영 적합성

세부 기준:
- 사람이 보이지 않으면 crowded, energetic, social을 높게 평가하지 않는다.
- 좌석이 비어 있다는 이유만으로 quiet 또는 peaceful을 지나치게 높게 평가하지 않는다.
- 좌석, 조명, 공간 구조가 확인되지 않으면 stay_long을 높게 평가하지 않는다.
- 낮은 조도와 간접조명은 warm_mood, intimate에 반영할 수 있다.
- date_friendly은 조명, 좌석 배치, 테이블 간 거리 등
  데이트 환경을 뒷받침하는 복수의 시각적 근거가 있을 때만 높게 평가한다.
- 야간 조명이나 어두운 외부 환경이 명확하지 않으면 night_mood를 높게 평가하지 않는다.
- 식물, 정원, 숲, 물 또는 자연 경관이 실제로 보일 때만
  nature_friendly를 높게 평가한다.
- 한옥 구조, 기와, 목조 기둥 등 건축적 근거가 있을 때만
  traditional_architecture를 높게 평가한다.
- 콘크리트, 유리, 금속, 현대적 구조 등 건축적 근거가 있을 때만
  modern_architecture를 높게 평가한다.
- 목재, 돌, 흙, 대나무, 한지 등의 소재가 실제로 식별될 때만
  natural_material을 높게 평가한다.
- 음식이 보이지 않으면 메뉴, 음식의 전통성, 맛 또는 식문화 경험을 추정하지 않는다.

────────────────────────────────────────
[summary 작성 규칙]
────────────────────────────────────────

- 이미지의 주된 대상이 음식인지 공간인지 자연스럽게 드러나도록 작성한다.
- 이미지에서 직접 확인되는 핵심 시각 요소를 1~2문장으로 요약한다.
- FOOD 이미지라면 음식, 식기, 색감, 플레이팅과 구도를 중심으로 작성한다.
- SPACE 이미지라면 공간, 좌석, 조명, 소재, 인테리어와 주변 환경을 중심으로 작성한다.
- 맛, 서비스, 추천 여부, 유명세, 실제 방문 경험을 포함하지 않는다.
- 장소명이나 지역명을 근거로 이미지에 없는 내용을 추가하지 않는다.

{SCORING_RULES}

{DETAIL_TAG_DEFINITIONS}
"""


def resolve_system_prompt(input_data: PlaceImageInput) -> str:
    """장소 카테고리에 따라 사용할 System Prompt를 선택한다."""
    if is_food_category(input_data.category):
        return FOOD_CATEGORY_ANALYSIS_PROMPT

    return GENERAL_PLACE_ANALYSIS_PROMPT


def build_user_prompt(input_data: PlaceImageInput) -> str:
    """이미지 분석 요청용 User Prompt를 생성한다.

    장소명과 지역명은 이미지 분석 편향을 일으킬 수 있으므로 전달하지 않는다.
    category는 System Prompt 선택에만 사용한다.
    """
    if is_food_category(input_data.category):
        return (
            "첨부된 음식점 또는 카페의 대표 이미지를 분석하라.\n"
            "먼저 이미지의 주된 대상이 FOOD인지 SPACE인지 내부적으로 판단하라.\n"
            "FOOD라면 음식 이미지에서 시각적으로 판단 가능한 태그만 평가하고, "
            "공간 의존 태그는 0.0에 가깝게 평가하라.\n"
            "채소, 생선, 고기 등 음식 재료 자체는 "
            "nature_friendly 또는 natural_material의 근거로 사용하지 마라.\n"
            "SPACE라면 매장 공간을 근거로 35개 세부 태그 전체를 평가하라.\n"
            "이미지 유형은 별도 필드로 반환하지 말고 "
            "35개 detail_scores와 summary만 반환하라."
        )

    return (
        "첨부된 관광지 대표 이미지를 분석하라.\n"
        "이미지에서 직접 확인되는 시각적 근거만 사용하여 "
        "35개 세부 태그 점수와 summary를 생성하라."
    )


def build_detail_scores_json_schema() -> dict:
    """OpenAI Structured Output용 JSON Schema를 생성한다."""
    properties = {
        tag: {
            "type": "number",
            "minimum": 0.0,
            "maximum": 1.0,
        }
        for tag in DETAIL_TAG_ORDER
    }

    return {
        "type": "object",
        "properties": {
            "detail_scores": {
                "type": "object",
                "properties": properties,
                "required": DETAIL_TAG_ORDER,
                "additionalProperties": False,
            },
            "summary": {
                "type": "string",
                "description": (
                    "이미지에서 직접 확인되는 주된 대상과 핵심 시각적 특성을 "
                    "1~2문장으로 요약한 문자열"
                ),
            },
        },
        "required": [
            "detail_scores",
            "summary",
        ],
        "additionalProperties": False,
    }