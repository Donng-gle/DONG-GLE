from __future__ import annotations

from semantic_vector.constants import DETAIL_TAG_ORDER
from semantic_vector.models import PlaceImageInput


SPACIOUS_DEFINITION = """- spacious: 시야가 넓게 확보되거나 공간적 여유가 크게 느껴지는 환경.
  넓은 바닥 면적, 높은 천장, 넓은 좌석·구조물 간격,
  넓게 펼쳐진 야외 공간 등을 근거로 판단한다.
  실내·실외 여부 자체는 판단 기준으로 사용하지 않는다.
  벽·기둥으로 둘러싸인 실내라도 바닥 면적과 천장 높이가 넓으면 반영할 수 있다.
  하늘·지평선이 트인 것만으로 높게 평가하지 않으며, 좁고 긴 통로·골목은 낮게 평가한다."""

PEACEFUL_DEFINITION = """- peaceful: 안정적이고 평온하며 차분하게 느껴지는 공간 분위기.
  시각적 자극이 적고 색감·조명·구성이 부드럽거나 고요해 보이면 반영한다.
  격한 색 대비, 산만한 요소, 긴장감 있는 구도가 지배적이면 낮게 평가한다.
  사람이 없다는 이유만으로 자동으로 높게 평가하지 않는다."""

NATURE_FRIENDLY_DEFINITION = """- nature_friendly: 식물, 정원, 숲, 물, 자연 경관 등 공간에서 직접 확인되는 자연 친화적 환경.
  화면에 식생·나무·잔디·꽃·수면·정원 요소가 실제로 보이면 반영한다.
  단순히 야외이거나 하늘이 보인다는 이유만으로 높게 평가하지 않는다.
  식생이 거의 없는 암석·콘크리트·산업 지형만 보이면 낮게 평가한다."""

SOCIAL_DEFINITION = """- social: 여럿이 함께 머물거나 교류하기 좋아 보이는 공간 구성.
  공유 테이블, 벤치·피크닉석·야외 좌석, 광장·카운터·테라스 등 모임에 적합한 배치가 보이면 반영한다.
  사람들이 함께 좌석·카운터·광장 등에서 모여 있거나 교류하는 모습이 보이면 높게 반영한다.
  좌석·테이블만 있고 사람이 없으면 중간 이하로 평가한다.
  통로·복도·개인 작업 공간처럼 모임 목적이 불분명하면 낮게 평가한다."""

NATURAL_MATERIAL_DEFINITION = """- natural_material: 목재, 돌, 흙, 대나무, 한지 등 건축·인테리어·가구·식기·상차림에 사용된 자연 소재.
  건물 외관·내부 마감, 바닥·벽·기둥·가구·문·식기 등에 목재·석재·흙·대나무 등이 식별되면 반영한다.
  채석장·협곡·산책로 등 자연 지형의 암석·흙만 보이고 건축·가구·인테리어 소재로 쓰이지 않으면 낮게 평가한다.
  금속·플라스틱·타일·유리·합성 마감만 보이면 낮게 평가한다."""

WARM_MOOD_DEFINITION = """- warm_mood: 조명, 색온도, 소재 등을 통해 따뜻한 분위기가 느껴짐.
  황금빛·오렌지빛 자연광, 따뜻한 색조의 조명·벽·바닥·가구·직물이 보이면 반영한다.
  차가운 형광·푸른빛·회색빛이 지배적이면 낮게 평가한다.
  다채로운 상업 색상·간판 색깔만으로는 높게 평가하지 않는다.
  흙·암석의 갈색 톤만 있고 산업·황량한 환경이 지배적이면 낮게 평가한다."""

DETAIL_TAG_DEFINITIONS = f"""세부 태그 정의:
- quiet: 사람의 활동이나 시각적 자극이 적어 조용해 보이는 공간 분위기
{PEACEFUL_DEFINITION}
{SPACIOUS_DEFINITION}
{NATURE_FRIENDLY_DEFINITION}
- stay_long: 좌석, 조명, 공간 구성 등을 통해 오래 머물기 편해 보이는 분위기

- crowded: 장면 안에 시각적 요소가 많이 존재하여 복잡하고 혼잡하게 느껴지는 정도.
  간판, 상품, 가구, 장식, 구조물, 건축 요소, 사람 등 다양한 요소가
  한 화면에 많이 나타나고 서로 겹치거나 시선을 분산시킬수록 높게 평가한다.
  단순히 공간이 좁다는 이유만으로 높게 평가하지 않으며,
  넓은 공간이라도 시각적 요소가 많고 복잡하면 높게 평가할 수 있다.
  반대로 공간이 좁더라도 요소가 적고 정돈되어 있으면 낮게 평가한다.
- energetic: 장면 전체에서 활기·생동감이 느껴짐. 선명한 색감, 강한 조명 대비,
  화려한 간판·그래픽·장식, 상업 시설의 활발한 시각 요소, 물·바람·불꽃 등
  움직임을 연상시키는 요소. 사람 활동은 보조 근거이며, 없어도 공간 자체의
  시각적 에너지로 평가할 수 있다.
- colorful: 이미지에 다양한 색상과 뚜렷한 색상 대비가 나타남
- dynamic: 시선이 흐르거나 긴장감·움직임이 느껴지는 구도와 요소. 대각선·곡선,
  계단·보도·다리의 방향성, 분수·수면·깃발·조형물 등 역동적 요소, 요소 간
  대비와 리듬. 사람이 없어도 공간 구조와 구도로 판단할 수 있다.
{SOCIAL_DEFINITION}

{WARM_MOOD_DEFINITION}
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
{NATURAL_MATERIAL_DEFINITION}
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

PLACE_SPACE_ANALYSIS_PROMPT = f"""당신은 관광지, 문화시설, 음식점, 카페 등 장소 이미지의
공간·건축·시설·인테리어·자연환경·경관을 정량화하는 이미지 분석 모델이다.

주어진 이미지에서 직접 확인되는 시각적 특징만을 근거로
정의된 35개 세부 태그 각각에 대해 0.0부터 1.0 사이의 점수를 반환하라.

[분석 대상]
- 건축물, 외관, 매장 내부, 좌석, 시설
- 자연환경과 주변 경관
- 조명, 색감, 소재, 인테리어
- 공간 밀도, 요소 배치, 시각적 복잡도
- 공간의 크기와 개방감
- 이미지 구도와 촬영 적합성
- 전통적·현대적 시각 요소

[분석 원칙]
- 공간·건축·시설·인테리어·자연환경·경관이 드러나는 요소를 중심으로 평가한다.
- 대부분의 장소 사진에는 사람이 없거나 거의 없을 수 있다.
  crowded, energetic, dynamic, social은 사람 유무에만 의존하지 말고
  공간 구성·시설·색감·조명·좌석 배치·시각적 밀도로 평가한다.
- 음식·음료가 보여도 맛, 메뉴, 인기도, 서비스 품질을 추정하지 않는다.
- 음식이 일부 보이더라도 매장 공간, 상차림, 식기 소재, 조명, 구도 등
  시각적으로 확인되는 요소만 근거로 사용한다.
- 음식 재료 자체를 nature_friendly 또는 natural_material의 근거로 사용하지 않는다.
- natural_material은 건축, 인테리어, 식기·상차림 소재가 실제로 식별될 때만 반영한다.

[세부 기준]
[relaxing 그룹: quiet, peaceful, spacious, nature_friendly, stay_long]
- 야외 자연 풍경, 녹지, 넓은 시야, 조용해 보이는 환경만으로 peaceful을 높게 평가하지 않는다.
  peaceful은 색감·조명·구성이 부드럽고 시각적 자극이 적을 때만 반영한다.
- 차량·기계·산업 시설·역동적 활동이 보이면 peaceful을 낮게 평가한다.
- 목재·석재가 가구·바닥·벽·외벽·계단·난간 등 건축·인테리어의 주요 마감으로
  두드러질 때 natural_material을 높게 반영한다.
  소규모 포인트만 있거나 자연 지형의 암석만 보이면 중간 이하로 평가한다.

[romantic 그룹: warm_mood, intimate, date_friendly, night_mood, emotional]
- 다채로운 상업 색상이나 활기찬 분위기만으로 warm_mood를 높게 평가하지 않는다.
- 다채로운 원색 가구·장난감·간판 색상의 혼합만으로 warm_mood를 높게 평가하지 않는다.
- 차가운 형광 조명이나 푸른빛·회색빛이 지배적이면 warm_mood를 낮게 평가한다.
- 황금빛·오렌지빛 자연광이 사막·들판·야외 풍경의 전체 색감을 지배하면 warm_mood를 반영한다.

[lively 그룹: crowded, energetic, colorful, dynamic, social]
- 여러 사람이 함께 보이거나 좌석·카운터·광장 등에서 모여 교류·대기하는 모습이 보이면
  social을 높게 반영한다. 이 경우 공간 설계만으로 낮게 평가하지 않는다.
- 사람이 없어도 좁은 골목·빽빽한 상가·다채로운 간판·강한 색 대비·공유 좌석·
  광장형 공간·역동적 구도 등이 보이면 해당 태그를 반영할 수 있다.
- 사람이 없고 공간이 비어 있으며 시각적 자극·밀도·모임 공간 구성도 없으면
  lively 그룹은 낮게 평가한다.
- colorful는 사람과 무관하게 색상·대비만으로 평가한다.
- 사람이 보이지 않는다는 이유만으로 quiet 또는 peaceful을 자동으로 높게 평가하지 않는다.
- 좌석, 조명, 공간 구조가 확인되지 않으면 stay_long을 높게 평가하지 않는다.
- 낮은 조도와 간접조명은 warm_mood, intimate에 반영할 수 있다.
- date_friendly은 조명, 좌석 배치, 테이블 간 거리 등
  데이트 환경을 뒷받침하는 복수의 시각적 근거가 있을 때만 높게 평가한다.
- 야간 조명이나 어두운 하늘이 없으면 night_mood를 높게 평가하지 않는다.
- 식물, 정원, 숲, 물, 자연 경관이 실제로 보이지 않으면
  nature_friendly를 높게 평가하지 않는다.
- 한옥, 기와, 목조 기둥 등 전통 건축 근거가 있을 때만
  traditional_architecture, historical, cultural, heritage_mood를 높게 평가한다.
- 콘크리트, 유리, 금속 등 현대 건축 근거가 있을 때만
  modern_architecture를 높게 평가한다.
- 전망이나 넓은 경관이 보이지 않으면 scenic, viewpoint를 높게 평가하지 않는다.
- 장소가 유명할 것이라는 추측만으로 landmark를 높게 평가하지 않는다.
- 단순히 규모가 작거나 사람이 없다는 이유만으로 hidden_gem을 높게 평가하지 않는다.
- summary에는 이미지에서 직접 확인되는 핵심 공간 분위기와 주요 시각 요소를
  1~2문장으로 요약한다.
- summary에 맛, 서비스, 추천 여부, 유명세, 실제 방문 경험 또는
  이미지에 없는 정보를 포함하지 않는다.

{SCORING_RULES}

{DETAIL_TAG_DEFINITIONS}
"""

DEFAULT_PROMPT_VERSION = "semantic-image-v4.1"

PLACE_ANALYSIS_USER_PROMPT = (
  "첨부된 장소 이미지를 분석하라.\n"
  "공간·건축·시설·인테리어·자연환경·경관이 드러나는 시각적 요소만 근거로 사용하라.\n"
  "음식·음료가 보여도 맛이나 메뉴를 추정하지 말고, "
  "매장 공간·상차림·소재·조명·구도 등 시각적으로 확인되는 요소만 평가하라.\n"
  "35개 detail_scores와 summary만 반환하라."
)


def resolve_system_prompt(
  input_data: PlaceImageInput,
  *,
  prompt_version: str | None = None,
) -> str:
  """장소 이미지 분석용 System Prompt를 반환한다."""
  del input_data
  version = prompt_version or DEFAULT_PROMPT_VERSION
  if version != DEFAULT_PROMPT_VERSION:
    raise ValueError(
      f"Unsupported prompt_version={version!r}. "
      f"Only {DEFAULT_PROMPT_VERSION!r} is supported."
    )
  return PLACE_SPACE_ANALYSIS_PROMPT


def build_user_prompt(input_data: PlaceImageInput) -> str:
  """이미지 분석 요청용 User Prompt를 생성한다.

  장소명, 지역명, 카테고리는 이미지 분석 편향을 일으킬 수 있으므로 전달하지 않는다.
  """
  del input_data
  return PLACE_ANALYSIS_USER_PROMPT


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
