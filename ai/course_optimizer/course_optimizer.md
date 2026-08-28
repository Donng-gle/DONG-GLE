# AI 기반 여행 코스 최적화 기능 구현 명세서

> 모듈 경로: `ai/course_optimizer/`  
> 구현 상태: `course_optimizer` 패키지 구현 완료. 대체 장소 검색은 `ai/semantic_vector/qdrant_repository.py`의 `get_detail_vector_by_place_id`, `search_similar_places_by_detail_vector`를 재사용한다.

> 이 문서는 이미 설계가 확정된 `AI 기반 여행 코스 최적화 방식 (v5)` 문서를 입력으로 받아, 방문 순서 탐색과 점수 계산 기능만 `ai` 폴더 아래에 구현하기 위한 단일 명세서이다.
>
> 사용자 취향 기반 장소 추천, `ai/semantic_vector`의 majorScores 생성 로직, 외부 API(Places/Routes)의 실제 자격증명 관리는 본 구현 범위에서 제외한다.

---

## 1. 기능 개요

### 1.1 기능명

**AI 기반 여행 코스 최적화(방문 순서 탐색 및 점수 계산) 기능**

### 1.2 목적

이미 취향 기반으로 추천된 후보 장소 목록(장소별 `majorScores` 7차원 벡터 보유)을 입력으로 받아 다음 작업을 수행한다.

1. 영업하지 않는 후보 장소를 확인하고, `ai/semantic_vector`의 Qdrant Detail Vector를 재사용해 대체 장소를 검색한다.
2. Google Places API로 장소별 운영시간을 조회하고, 정보가 없으면 category 기반 fallback을 적용한다.
3. Google Routes API로 장소 간 이동시간 행렬을 생성한다.
4. LLM을 1회 호출해 장소별 시간대 적합도, 장소 간 전이 적합도, 장소별 활동·휴식 특성을 생성한다.
5. 백트래킹으로 방문 가능한 모든 순서를 탐색하고, 물리적으로 불가능한 경로를 가지치기한다.
6. 실행 가능한 각 경로의 여행 경험 점수(시간대·전이·균형)와 이동 효율 점수(절대 정규화)를 계산한다.
7. 두 점수의 가중 평균이 가장 높은 경로를 최종 코스로 선택한다.

### 1.3 구현 전제

다음 기능은 이미 구현되어 있다고 가정한다.

- 사용자 취향 기반 장소 추천 (본 모듈에 후보 장소 목록을 전달하는 상위 서비스)
- `ai/semantic_vector`의 GPT Vision 기반 `majorScores`
(7차원) / Detail Vector(35차원) 생성 및 Qdrant 저장
- `ai/semantic_vector.qdrant_repository`의 Collection 접근 함수
- Google Maps Platform API 키 및 클라이언트 초기화
- 사용자 입력(여행 시작/종료 시간, 이동수단, 출발지, 고정 도착지, 후보 장소 목록) 수집 UI/API

본 모듈은 위 기능을 다시 구현하지 않는다.

### 1.4 핵심 원칙

- 장소를 표현하는 최종 태그는 `majorScores` 7차원 벡터 하나뿐이며, 자유 텍스트 태그 형태는 사용하지 않는다.
- LLM은 완성된 경로 각각을 평가하지 않고, 탐색 전체에서 재사용 가능한 평가 정보(시간대 적합도·전이 적합도·활동휴식 특성)를 **1회 호출**로 생성한다.
- 전이 적합도의 채점 기준은 알고리즘 내부의 결정론적 공식으로 두지 않고, LLM 프롬프트의 앵커 예시로만 정의한다.
- 활동·휴식 균형은 어떤 경우에도 가지치기(경로 탈락) 대상이 아니며, 점수 감점으로만 반영한다.
- 방문 순서 탐색은 백트래킹 + 가지치기로 구현하며, 후보가 9~10곳 이상으로 늘어나 실측으로 성능 문제가 확인되기 전까지는 DP·Beam Search 등 대안을 도입하지 않는다.
- 부분 경로를 허용하되 최소 방문 장소 수는 2곳으로 강제한다.
- 이동 효율 점수는 후보 경로 간 상대 비교가 아닌, 전체 여행 가능시간 대비 절대 기준으로 정규화한다.
- 균형 점수의 연속 페널티 계수(k1, k2)와 종합 점수의 가중치(w1, w2)는 고정값이 아니라 초기값 + 실측 검증 절차를 가진 파라미터로 관리한다.

---

## 2. 구현 범위

### 2.1 포함 범위

- 후보 장소 입력 정규화 (`CandidatePlace` 모델 변환)
- 영업 여부 확인 및 대체 장소 검색 연동 (`ai/semantic_vector` Qdrant 재사용)
- Places API 운영시간 조회 및 category fallback 적용
- Routes API 이동시간 행렬 생성
- 장소 유형별 기본·최소 체류시간 설정
- LLM 프롬프트 구성 (전이 채점 앵커 예시 포함)
- LLM 1회 호출 및 구조화 응답 파싱
- LLM 응답 검증 (장소 누락, 점수 범위, 차원 검증)
- 백트래킹 기반 방문 순서 탐색
- 가지치기 조건 적용 (운영시간, 체류시간, 여행 종료시간, 고정 도착지, 최소 방문 수, lower-bound)
- 여행 경험 점수 계산 (시간대·전이·균형)
- 이동 효율 점수 계산 (절대 기준 정규화)
- 종합 점수 계산 및 최종 코스 선택
- 단위 테스트 및 Mock 기반 통합 테스트

### 2.2 제외 범위

- 사용자 취향 기반 장소 추천 로직
- `majorScores`/Detail Vector 생성 로직 (`ai/semantic_vector`가 담당)
- PostgreSQL 연결 및 장소 DB 조회
- Google Maps Platform 클라이언트 인증/키 관리 (설정값 주입만 담당)
- 최종 코스 추천 이유를 생성하는 2차 LLM 호출 (별도 모듈로 분리, 본 명세서 범위 아님)
- 프론트엔드 UI
- `ai/semantic_vector`의 GPT Vision·Major Score 생성 로직 재구현

---

## 3. 전체 처리 흐름

```text
상위 서비스 (취향 기반 추천 결과)
    │
    ▼
CandidatePlace 목록 (majorScores 포함)
    │
    ▼
ai/course_optimizer
    │
    ├── 영업 여부 확인 + Qdrant 대체 장소 검색 (ai/semantic_vector 재사용)
    ├── Places API 운영시간 조회 (+ fallback)
    ├── Routes API 이동시간 행렬 생성
    ├── 체류시간 설정
    ├── LLM 1회 호출 → 재사용 가능한 평가 정보
    ├── 백트래킹 + 가지치기
    ├── 여행 경험 점수 / 이동 효율 점수 계산
    └── 종합 점수 최댓값 코스 선택
    │
    ▼
CourseOptimizationResult
```

좀 더 구체적인 흐름은 다음과 같다.

```text
optimize_course()
        │
        ▼
후보 장소 정규화 및 영업 여부 확인
        │
        ├── 영업 중단 장소 → replacement_client로 대체
        ▼
운영시간 조회 (+ fallback)
        │
        ▼
이동시간 행렬 생성
        │
        ▼
체류시간 설정
        │
        ▼
call_course_evaluation()  (LLM 1회 호출)
        │
        ▼
백트래킹 탐색 (가지치기 적용)
        │
        ▼
실행 가능한 경로별 점수 계산
        │
        ▼
TotalScore 최댓값 경로 선택
        │
        ▼
CourseOptimizationResult 반환
```

---

## 4. 권장 폴더 구조

`ai` 폴더 안에 새 기능 전용 폴더를 생성한다.

```text
ai/
├── semantic_vector/
│   └── ...
│
└── course_optimizer/
    ├── __init__.py
    ├── config.py
    ├── constants.py
    ├── models.py
    ├── prompt.py
    ├── validators.py
    ├── llm_client.py
    ├── places_client.py
    ├── routes_client.py
    ├── replacement_client.py
    ├── operating_hours.py
    ├── score_calculator.py
    ├── backtracking.py
    ├── planner.py
    ├── exceptions.py
    ├── course_optimizer.md
    └── tests/
        ├── __init__.py
        ├── test_validators.py
        ├── test_operating_hours.py
        ├── test_score_calculator.py
        ├── test_backtracking.py
        ├── test_planner.py
        └── test_llm_client.py
```

### 4.1 폴더명

권장 폴더명:

```text
ai/course_optimizer
```

이유:

- 코스 "추천"이 아니라 이미 추천된 장소의 방문 "순서 최적화"를 담당함을 명확히 표현한다.
- `ai/semantic_vector`와 대칭되는 위치에서, 두 모듈이 서로 다른 책임(태그 생성 vs 순서 최적화)을 갖는다는 것을 이름으로 드러낸다.
- 향후 코스 설명 생성, 다중 일자 코스 확장 등을 이 이름 아래 자연스럽게 추가할 수 있다.

---

## 5. 기존 모듈과의 연결 규칙

### 5.1 의존 방향

허용:

```text
ai/course_optimizer
        ↓ import
ai/semantic_vector   (2.0절 대체 장소 검색 시 Qdrant repository 재사용)
```

금지:

```text
ai/semantic_vector
        ↓ import
ai/course_optimizer

data/pipeline
        ↓ import
ai/course_optimizer
```

`ai/course_optimizer`가 `data/pipeline`을 직접 의존하지 않는다. 후보 장소 목록은 상위 서비스 계층이 조립해 전달한다.

### 5.2 입력 계약

상위 서비스가 전달하는 실제 dict 또는 추천 결과 객체를 `planner.py` 내부에서 그대로 사용하지 말고, 입력 모델로 변환한다.

```python
class CandidatePlace(BaseModel):
    place_id: str
    category: str
    major_scores: MajorScores  # ai/semantic_vector.models.MajorScores 재사용

    latitude: float
    longitude: float
    name: str | None = None
```

```python
class TripInput(BaseModel):
    start_time: datetime
    end_time: datetime
    transport_mode: Literal["walk", "transit", "car"]

    origin: LatLng
    fixed_destination: LatLng | None = None

    candidates: list[CandidatePlace]
```

기존 추천 결과 필드명이 다를 경우 호출부(상위 서비스)에서 명시적으로 매핑해 `TripInput`을 구성한다.

### 5.3 금지 사항

- `ai/course_optimizer` 내부에서 DB Session 생성 금지
- `ai/course_optimizer` 내부에서 장소 추천 SQL 또는 추천 로직 작성 금지
- `ai/semantic_vector`의 GPT Vision 호출·Major Score 계산 로직 재구현 금지 (Qdrant 조회 함수만 재사용)
- Places API·Routes API 인증/키 관리 로직을 `config.py` 밖에 흩어놓지 않는다
- 상위 서비스의 추천 결과 dict 접근을 여러 파일에 흩어놓지 않는다 (변환은 `planner.py`의 진입점 한 곳에서 수행)

---

## 6. 각 파일의 역할

## 6.1 `__init__.py`

외부에서 사용할 Public API를 노출한다.

```python
from .planner import optimize_course
from .models import (
    TripInput,
    CandidatePlace,
    CourseOptimizationResult,
    ScoredRoute,
)
```

사용 예:

```python
from ai.course_optimizer import optimize_course, TripInput
```

---

## 6.2 `config.py`

환경변수 및 설정값을 관리한다.

```python
class CourseOptimizerConfig(BaseSettings):
    openai_api_key: str
    openai_model: str = "gpt-4.1-mini"

    google_maps_api_key: str

    prompt_version: str = "course-evaluation-v1"

    # 7.3.1절 — 균형 점수 연속 페널티 초기값
    balance_penalty_k1: float = 5.0   # 활동 연속
    balance_penalty_k2: float = 5.0   # 휴식 연속
    category_repeat_penalty: float = 5.0

    # 9.1절 — 종합 점수 가중치 초기값
    experience_weight: float = 0.5    # w1
    travel_weight: float = 0.5        # w2

    min_visit_count: int = 2          # 11.1절 — 최소 방문 장소 수

    max_retry_count: int = 3
```

환경변수 예:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini

GOOGLE_MAPS_API_KEY=

COURSE_PROMPT_VERSION=course-evaluation-v1

COURSE_BALANCE_PENALTY_K1=5.0
COURSE_BALANCE_PENALTY_K2=5.0
COURSE_CATEGORY_REPEAT_PENALTY=5.0

COURSE_EXPERIENCE_WEIGHT=0.5
COURSE_TRAVEL_WEIGHT=0.5

COURSE_MIN_VISIT_COUNT=2
COURSE_MAX_RETRY_COUNT=3
```

---

## 6.3 `constants.py`

시간대 구분, 체류시간, fallback 운영시간을 정의한다.

```python
TIME_SLOTS = {
    "morning": (time(6, 0), time(11, 0)),
    "lunch": (time(11, 0), time(14, 0)),
    "afternoon": (time(14, 0), time(18, 0)),
    "evening": (time(18, 0), time(22, 0)),
}
```

```python
DEFAULT_STAY_MINUTES = {
    "attraction": 60,
    "cafe": 60,
    "restaurant": 60,
    "museum": 90,
    "market": 60,
    "park": 60,
    "night_view": 40,
}

MIN_STAY_MINUTES = {
    "attraction": 30,
    "cafe": 30,
    "restaurant": 40,
    "museum": 45,
    "market": 30,
    "park": 30,
    "night_view": 30,
}
```

```python
OPERATING_HOURS_FALLBACK = {
    "attraction_outdoor": None,        # 상시 개방
    "attraction_indoor": (time(9, 0), time(18, 0)),
    "market": (time(9, 0), time(21, 0)),
    "cafe": (time(8, 0), time(22, 0)),
    "restaurant": (time(11, 0), time(21, 0)),
    "museum": (time(9, 0), time(18, 0)),
    "night_view": None,                # 상시 개방
}
```

- `TIME_SLOTS`, `DEFAULT_STAY_MINUTES`, `MIN_STAY_MINUTES`, `OPERATING_HOURS_FALLBACK`은 v5 문서 2.1절, 2.1.1절, 2.2절, 5절의 표를 그대로 코드 상수로 옮긴 것이다. 표 내용이 바뀌면 이 파일만 수정한다.

---

## 6.4 `models.py`

입력, LLM 응답, 경로, 결과 모델을 정의한다.

### `CandidatePlace` / `TripInput`

5.2절 참조.

### `TimeSuitability`

```python
class TimeSuitability(BaseModel):
    morning: float
    lunch: float
    afternoon: float
    evening: float
```

### `PlaceFeatures`

```python
class PlaceFeatures(BaseModel):
    activity_level: float
    rest_level: float
```

### `CourseEvaluationInfo` (LLM 1회 호출 결과)

```python
class CourseEvaluationInfo(BaseModel):
    time_suitability: dict[str, TimeSuitability]      # place_id -> 시간대 적합도
    transition_scores: dict[str, dict[str, float]]     # place_id -> {place_id: score}
    place_features: dict[str, PlaceFeatures]           # place_id -> 활동/휴식 특성
```

### `VisitStop`

```python
class VisitStop(BaseModel):
    place_id: str
    arrival_time: datetime
    visit_start_time: datetime
    departure_time: datetime
    actual_stay_minutes: int
```

### `RouteScoreBreakdown`

```python
class RouteScoreBreakdown(BaseModel):
    time_score: float
    transition_score: float
    balance_score: float
    experience_score: float

    total_travel_minutes: int
    travel_score: float

    total_score: float
```

### `ScoredRoute`

```python
class ScoredRoute(BaseModel):
    stops: list[VisitStop]
    score: RouteScoreBreakdown
```

### `CourseOptimizationResult`

```python
class CourseOptimizationResult(BaseModel):
    selected_route: ScoredRoute
    candidate_route_count: int
    evaluated_route_count: int
    target_visit_count: int
    free_time_minutes: int = 0

    prompt_version: str
    model_name: str

    excluded_place_ids: list[str] = []   # 영업 중단 등으로 후보에서 제외된 장소
    excluded_places: list[str] = []      # k < N일 때 코스에 포함되지 않은 후보
    exclusion_reason: dict[str, str] = {}  # excluded_places별 제외 사유
    replaced_places: dict[str, str] = {}
```

---

## 6.5 `prompt.py`

LLM 1회 호출용 프롬프트를 관리한다.

### 요구사항

- Prompt 본문은 이 파일에서만 관리한다.
- 입력은 후보 장소들의 `majorScores`(7차원) 벡터와 `category`만 사용하며, 자유 텍스트 태그를 입력으로 받지 않는다.
- 시간대 적합도·전이 적합도·활동휴식 특성 세 가지를 하나의 구조화 JSON으로 요청한다.
- 전이 적합도 채점 기준은 v5 문서 6.2절의 앵커 예시(활동→휴식 전환, 동일 category 반복, 정반대 성격 급변, 유사 성격 지속)를 프롬프트에 고정 포함한다.
- JSON 이외의 출력을 금지한다.

### System Prompt 예시

```text
당신은 여행 코스의 장소별 시간대 적합도, 장소 간 전이 적합도,
장소별 활동·휴식 특성을 판단하는 분석 모델이다.

각 장소는 7차원 majorScores 벡터
(relaxing, lively, romantic, local, photogenic, traditional, modern)
와 category로 주어진다.

## 시간대 적합도
각 장소가 morning/lunch/afternoon/evening 네 시간대에
얼마나 적합한지 0.0~1.0으로 판단하라.

## 전이 적합도
두 장소 사이 방문 순서 A→B가 얼마나 자연스러운지 0.0~1.0으로 판단하라.
다음 기준을 반드시 따른다.

- lively가 높은 장소 다음에 relaxing이 높은 장소로 이어지면
  자연스러운 전환으로 간주해 0.85~0.90 수준의 높은 점수를 준다.
- 동일한 category가 연속되면 반복으로 간주해 0.40~0.55 수준의 점수를 준다.
- traditional과 modern처럼 정반대 성격이 급격히 뒤바뀌면
  분위기 단절로 간주해 0.20~0.30 수준의 낮은 점수를 준다.
- 위에 해당하지 않으면 두 벡터의 전반적 유사도로 0.75~0.85 수준의
  중간~높은 점수를 준다.

## 활동·휴식 특성
각 장소의 activityLevel, restLevel을 0.0~1.0으로 판단하라.
majorScores에서 기계적으로 파생시키지 말고, 이미지에서 확인되는
활동성/휴식성을 직접 판단한다.

지정된 JSON Schema에 맞는 JSON만 반환한다.
```

### User Prompt 예시

```text
다음은 방문 후보 장소 목록이다.

{candidate_places_json}

위 장소들에 대해 시간대 적합도, 모든 장소 쌍의 전이 적합도(양방향),
활동·휴식 특성을 생성하라.
```

---

## 6.6 `validators.py`

LLM 응답과 입력을 검증한다.

### `validate_score()`

```python
def validate_score(value: float, field_name: str) -> float:
    ...
```

규칙:

- 숫자여야 한다.
- `NaN`, `inf`, `-inf` 금지
- `0.0 <= value <= 1.0`
- 자동 clamp 금지

### `validate_evaluation_coverage()`

```python
def validate_evaluation_coverage(
    evaluation: CourseEvaluationInfo,
    candidates: Sequence[CandidatePlace],
) -> None:
    ...
```

규칙:

- `time_suitability`, `place_features`에 모든 후보 `place_id`가 존재해야 한다.
- `transition_scores`는 모든 순서쌍 `(A, B)`, `A != B`에 대해 존재해야 한다 (양방향, 대칭 아님).
- 존재하지 않는 `place_id`를 키로 가지면 오류.

### `validate_trip_input()`

```python
def validate_trip_input(trip: TripInput) -> None:
    ...
```

규칙:

- `end_time > start_time`
- 후보 장소 수 ≥ `config.min_visit_count`
- 후보 장소 `place_id` 중복 금지

---

## 6.7 `llm_client.py`

LLM 1회 호출만 담당한다.

```python
async def call_course_evaluation(
    candidates: Sequence[CandidatePlace],
    *,
    config: CourseOptimizerConfig,
) -> CourseEvaluationInfo:
    ...
```

### 책임

- Prompt 조합 (`prompt.py` 사용)
- 후보 장소 majorScores/category 직렬화
- OpenAI API 호출 (Structured Output)
- 응답 파싱
- `validators.validate_evaluation_coverage()` 호출
- API 오류 변환, 재시도 대상 오류 식별

### 금지

- 점수 계산 (`score_calculator.py`의 책임)
- 백트래킹 (`backtracking.py`의 책임)
- Places/Routes API 호출

---

## 6.8 `places_client.py` / `operating_hours.py`

`places_client.py`는 Google Places API 호출만 담당한다.

```python
async def fetch_operating_hours(
    place_id: str,
    *,
    config: CourseOptimizerConfig,
) -> RawOperatingHours | None:
    ...
```

`operating_hours.py`는 fallback 및 실제 체류시간 계산 로직을 담당한다 (외부 API 호출 없음).

```python
def resolve_operating_hours(
    category: str,
    raw_hours: RawOperatingHours | None,
) -> ResolvedOperatingHours:
    """
    v5 2.1.1절 2단계 fallback 적용.
    1단계: category 기반 OPERATING_HOURS_FALLBACK 조회
    2단계: fallback도 없으면 상시 개방으로 간주 (최소 체류시간 조건은 유지)
    """
    ...
```

```python
def calculate_actual_stay_minutes(
    default_stay: int,
    min_stay: int,
    visit_start: datetime,
    closing_time: datetime,
) -> int | None:
    """
    실제 체류시간 = min(기본 체류시간, 운영 종료시간 - 방문 시작시간)
    최소 체류시간 미만이면 None 반환 (해당 경로 가지치기 신호)
    """
    ...
```

---

## 6.9 `routes_client.py`

Google Routes API 호출만 담당한다.

```python
async def build_travel_time_matrix(
    trip: TripInput,
    *,
    config: CourseOptimizerConfig,
) -> TravelTimeMatrix:
    """
    출발지-후보, 후보-후보, 후보-고정도착지 간
    이동수단별 이동시간(분)을 조회한다. 방향별로 비대칭일 수 있다.
    """
    ...
```

---

## 6.10 `replacement_client.py`

영업하지 않는 장소를 같은 category 내에서 대체한다. `ai/semantic_vector`의 Qdrant repository를 재사용한다.

```python
async def find_replacement_place(
    original: CandidatePlace,
    exclude_place_ids: set[str],
    *,
    config: CourseOptimizerConfig,
) -> CandidatePlace | None:
    """
    ai.semantic_vector.qdrant_repository의 검색 함수를 사용해,
    동일 category 내에서 35차원 Detail Vector 기준
    Cosine Similarity가 가장 높은 장소를 조회한다.
    자체적으로 Qdrant 클라이언트를 새로 만들지 않는다.
    """
    ...
```

### 금지

- `ai/semantic_vector`의 Collection 생성·Upsert 로직 재구현
- 자체 Qdrant 클라이언트 초기화 (기존 repository 함수 재사용)

### `ai/semantic_vector/qdrant_repository.py` (재사용)

- `get_detail_vector_by_place_id(place_id, *, config)` — place_id의 Detail Vector 조회
- `search_similar_places_by_detail_vector(detail_vector, *, config, category, exclude_place_ids, limit)` — Cosine Similarity 검색

---

## 6.11 `score_calculator.py`

v5 문서 7절·8절·9절의 점수 공식을 그대로 구현한다.

### `calculate_time_score()`

```python
def calculate_time_score(
    stops: Sequence[VisitStop],
    evaluation: CourseEvaluationInfo,
) -> float:
    """
    TimeScore = 각 장소의 (방문 시작 시각이 속한 시간대) 적합도 합 / 방문 장소 수
    (v5 5.1절 — 시간대 경계는 시작 시각 기준 단일 시간대 사용)
    """
    ...
```

### `calculate_transition_score()`

```python
def calculate_transition_score(
    stops: Sequence[VisitStop],
    evaluation: CourseEvaluationInfo,
) -> float:
    """
    TransitionScore = 연속 구간 전이 적합도 합 / 전이 횟수
    방문 장소 수는 항상 min_visit_count(기본 2) 이상이므로
    전이 횟수 0 케이스는 다루지 않는다. (v5 8.2절)
    """
    ...
```

### `calculate_balance_score()`

```python
def calculate_balance_score(
    stops: Sequence[VisitStop],
    evaluation: CourseEvaluationInfo,
    *,
    config: CourseOptimizerConfig,
) -> float:
    """
    v5 7.3절 연속 길이 기반 페널티.

    PenaltyActivity = k1 * max(0, activityLevel>=0.7 연속길이 - 2) ** 2
    PenaltyRest     = k2 * max(0, restLevel>=0.7 연속길이 - 2) ** 2
    CategoryRepeatPenalty = 동일 category 연속 1회당 category_repeat_penalty

    BalanceScore = max(0, 100 - PenaltyActivity - PenaltyRest - CategoryRepeatPenalty)

    이 함수는 오직 점수만 반환하며, 경로 탈락 여부를 결정하지 않는다.
    (활동/휴식 균형은 backtracking.py의 가지치기 조건에 절대 포함하지 않는다.)
    """
    ...
```

### `calculate_experience_score()`

```python
def calculate_experience_score(
    time_score: float,
    transition_score: float,
    balance_score: float,
) -> float:
    """
    ExperienceScore = (TimeScore×100 + TransitionScore×100 + BalanceScore) / 3

    TimeScore·TransitionScore는 0.0~1.0, BalanceScore는 0~100 척도이므로
    앞 두 항을 100점 척도로 환산한 뒤 BalanceScore와 동일 스케일에서 평균한다.
    """
    return (time_score * 100 + transition_score * 100 + balance_score) / 3
```

### `calculate_travel_score()`

```python
def calculate_travel_score(
    total_travel_minutes: int,
    trip: TripInput,
) -> float:
    """
    v5 8절 절대 기준 정규화.
    TravelScore = 100 * max(0, 1 - 총 이동시간 / 전체 여행 가능시간)

    총 이동시간 정의(v5 8절 보완):
    출발지→첫 방문 장소, 방문 장소 간, 마지막 방문 장소→고정 도착지(있는 경우)
    까지의 이동시간 합. 고정 도착지가 없으면 마지막 장소 이후 이동시간은 제외.
    """
    ...
```

### `calculate_total_score()`

```python
def calculate_total_score(
    experience_score: float,
    travel_score: float,
    *,
    config: CourseOptimizerConfig,
) -> float:
    """
    TotalScore = w1 * ExperienceScore + w2 * TravelScore
    초기값 w1=w2=0.5 (config.experience_weight, config.travel_weight)
    """
    ...
```

### 규칙

- 모든 함수는 순수 함수로 작성한다 (외부 API 호출 금지).
- 동일 입력에 동일 출력을 보장한다.
- 내부 계산 중 임의 반올림을 하지 않는다.

---

## 6.12 `backtracking.py`

방문 순서 탐색과 가지치기를 담당한다. **k(방문 수) 우선순위 탐색**을 사용한다.

```python
def search_optimal_route(
    trip: TripInput,
    candidates: Sequence[CandidatePlace],
    resolved_hours: dict[str, ResolvedOperatingHours],
    travel_matrix: TravelTimeMatrix,
    evaluation: CourseEvaluationInfo,
    *,
    config: CourseOptimizerConfig,
) -> RouteSearchResult:
    """
    반환값: RouteSearchResult
      - selected_route: 선택된 경로
      - target_visit_count: 확정된 방문 수 k
      - evaluated_route_count: 점수 계산된 실행 가능 경로 수
      - candidate_route_count: 탐색 후보 경로 수
      - free_time_minutes: 마지막 방문 종료 후 남는 자유 시간(분)
      - excluded_places / exclusion_reason: k < N일 때만 채움
    """
    ...
```

### k(방문 수) 우선순위 탐색

서로 다른 방문 개수의 경로를 같은 TotalScore로 비교하면, 방문 수가 늘수록 TravelScore가 누적되어 **적게 방문할수록 유리한 편향**이 생긴다. 이를 방지하기 위해 아래 순서로 탐색한다.

```text
k = N (전체 후보 수)부터 시작
    ↓
정확히 k곳을 방문하는 실행 가능한 경로를 백트래킹으로 탐색
    ↓
하나라도 있으면 → 그 k의 경로들끼리만 TotalScore 비교 후 종료
    ↓
없으면 k = k - 1 로 내려서 재시도 (min_visit_count까지)
    ↓
min_visit_count에서도 없으면 → NoFeasibleRouteError
```

- k=N에서 성공하면 k=N-1 이하 부분 경로는 **비교 대상에서 제외**한다.
- 각 k 탐색은 정확히 `P(N, k)` 순열(가지치기 후 실제 평가 수)만 대상으로 한다.
- `min_visit_count` 이상의 부분 경로를 한 번에 모두 탐색하는 기존 방식은 사용하지 않는다.

### 자유 시간

k곳 방문이 확정된 뒤에도 여행 종료 시각까지 시간이 남으면:

- 추가 장소를 끼워 넣지 않는다.
- 체류시간을 늘리지 않는다 (기본 체류시간 유지).
- `free_time_minutes`에 남는 시간을 그대로 기록한다.

### 제외 장소 사유 (k < N)

최종 k가 N보다 작을 때, 코스에 포함되지 않은 후보는 `excluded_places`에 담는다.
`exclusion_reason`은 **실행 가능한 경로가 하나도 없었던 가장 큰 k 시도**의 가지치기 로그에서,
각 장소별로 가장 자주 기록된 사유를 매핑한다.

| 내부 코드 | 사용자 메시지 |
|---|---|
| `time_exceeded` | 이동시간 초과로 시간 내 방문 불가 |
| `closed_hours` | 영업시간 외 도착으로 방문 불가 |
| `insufficient_stay` | 최소 체류시간 확보 불가 |
| `lower_bound` | 남은 일정으로 방문 불가 |
| `unknown` | 시간 내 방문 불가 |

**한계:** `lower_bound` 가지치기는 남은 후보 전체에 동시에 기록되므로, 특정 장소가 "왜 빠졌는지"를 단일 원인으로 정확히 특정하기 어렵다. 이후 보완 가능.

### 탐색 시간 특성

| 상황 | 기존(2~N 동시) | k 우선 |
|---|---|---|
| k=N 즉시 성공 | Σ P(N,k) 전부 탐색 | P(N,N)만 탐색 → **더 빠름** |
| k=N~k_min+1 실패 후 k_min 성공 | Σ P(N,k) 1회 | 실패한 k마다 P(N,k) 반복 → **비슷하거나 다소 느림** |
| 최악 (k=N~min 전부 실패) | Σ P(N,k) 1회 | Σ P(N,k)와 동일 수준 |

### 가지치기 조건 (v5 11절, 순서 무관하게 모두 적용)

- 장소가 해당 날짜에 운영하지 않음 (`resolved_hours`가 fallback 포함 이미 반영됨)
- 실제 체류 가능 시간이 최소 체류시간보다 짧음 (`operating_hours.calculate_actual_stay_minutes()`가 `None` 반환)
- 브레이크타임/방문 불가 시간과 겹침
- 전체 여행 종료시간을 초과함
- 고정 도착지까지 남은 시간 안에 도달할 수 없음
- 이미 방문한 장소를 다시 선택함
- 방문 장소 수가 `target_k`에 도달하지 못한 채 더 이상 확장할 수 없음
- 남은 장소를 `target_k`까지 방문하는 것이 시간상 불가능함 (lower-bound)

**활동·휴식 균형(activityLevel/restLevel)은 위 조건에 절대 포함하지 않는다.** 이는 물리적 제약이 아니라 상대적 선호도 문제이므로, `score_calculator.calculate_balance_score()`의 감점으로만 처리한다. 이 원칙을 위반하는 구현(예: 연속된 고활동 장소를 이유로 경로를 탐색 중 제거하는 코드)은 리뷰에서 반려한다.

---

## 6.13 `planner.py`

전체 흐름을 조정하는 진입점이다.

### Public 함수

```python
async def optimize_course(
    trip: TripInput,
    *,
    config: CourseOptimizerConfig | None = None,
) -> CourseOptimizationResult:
    ...
```

### 처리 순서

```text
TripInput 검증 (validators.validate_trip_input)
    ↓
영업 여부 확인 + 대체 장소 검색 (replacement_client)
    ↓
운영시간 조회 + fallback 해석 (places_client + operating_hours)
    ↓
이동시간 행렬 생성 (routes_client)
    ↓
기본·최소 체류시간 설정 (constants)
    ↓
LLM 1회 호출 (llm_client.call_course_evaluation)
    ↓
백트래킹 + 가지치기 (backtracking.search_optimal_route)
    ↓
실행 가능한 경로별 점수 계산 (score_calculator)
    ↓
TotalScore 최댓값 경로 선택
    ↓
CourseOptimizationResult 반환
```

### 의사 코드

```python
async def optimize_course(
    trip: TripInput,
    *,
    config: CourseOptimizerConfig | None = None,
) -> CourseOptimizationResult:
    resolved_config = config or CourseOptimizerConfig()

    validate_trip_input(trip)

    candidates = await ensure_open_candidates(
        trip.candidates,
        config=resolved_config,
    )

    resolved_hours = {
        place.place_id: resolve_operating_hours(
            place.category,
            await fetch_operating_hours(place.place_id, config=resolved_config),
        )
        for place in candidates
    }

    travel_matrix = await build_travel_time_matrix(trip, config=resolved_config)

    evaluation = await call_course_evaluation(candidates, config=resolved_config)

    route = search_optimal_route(
        trip,
        candidates,
        resolved_hours,
        travel_matrix,
        evaluation,
        config=resolved_config,
    )

    return CourseOptimizationResult(
        selected_route=route.selected_route,
        candidate_route_count=route.candidate_route_count,
        evaluated_route_count=route.evaluated_route_count,
        target_visit_count=route.target_visit_count,
        free_time_minutes=route.free_time_minutes,
        prompt_version=resolved_config.prompt_version,
        model_name=resolved_config.openai_model,
        excluded_places=route.excluded_places,
        exclusion_reason=route.exclusion_reason,
    )
```

---

## 6.14 `exceptions.py`

```python
class CourseOptimizerError(Exception): ...
class InvalidTripInputError(CourseOptimizerError): ...
class InvalidCourseEvaluationError(CourseOptimizerError): ...
class NoFeasibleRouteError(CourseOptimizerError): ...
class PlacesApiError(CourseOptimizerError): ...
class RoutesApiError(CourseOptimizerError): ...
class ReplacementNotFoundError(CourseOptimizerError): ...
```

---

## 7. 오류 처리 정책

| 상황 | 처리 |
|---|---|
| `end_time <= start_time` | `InvalidTripInputError` |
| 후보 장소 수 < `min_visit_count` | `InvalidTripInputError` |
| 후보 장소 `place_id` 중복 | `InvalidTripInputError` |
| Places API 인증 오류 | 즉시 실패 (`PlacesApiError`) |
| Places API 429/5xx/Timeout | 재시도 |
| 운영시간 정보 없음 | `operating_hours.resolve_operating_hours()`의 fallback 적용 (오류 아님) |
| Routes API 인증 오류 | 즉시 실패 (`RoutesApiError`) |
| Routes API 429/5xx/Timeout | 재시도 |
| LLM 인증 오류 | 즉시 실패 |
| LLM 429/5xx/Timeout | 재시도 |
| LLM JSON 파싱 실패 | `InvalidCourseEvaluationError` |
| LLM 응답에 후보 장소 누락 | `InvalidCourseEvaluationError` |
| LLM 응답 점수 범위 오류 | validation error |
| 영업하지 않는 장소의 대체 실패 | `ReplacementNotFoundError` (해당 장소는 후보에서 제외하고 진행, 상위 서비스에 경고 반환) |
| 가지치기 후 실행 가능한 경로가 0개 | `NoFeasibleRouteError` |

---

## 8. 재시도 정책

### 재시도 대상

- Google Places API HTTP 429/5xx/Timeout
- Google Routes API HTTP 429/5xx/Timeout
- OpenAI HTTP 429/5xx/Timeout
- Qdrant(대체 장소 검색) 일시적 연결 오류

### 재시도하지 않는 오류

- 인증 오류
- 입력 모델 검증 오류 (`InvalidTripInputError`)
- LLM JSON Schema 불일치 (`InvalidCourseEvaluationError`)
- 점수 범위 오류
- 실행 가능한 경로 0개 (`NoFeasibleRouteError`) — 재시도해도 결과가 바뀌지 않음

### 기본값

```text
최대 3회
1초 → 2초 → 4초
```

---

## 9. 테스트 요구사항

## 9.1 `test_validators.py`

- 정상 `TripInput` 통과
- `end_time <= start_time` 예외
- 후보 수 부족 예외 (`min_visit_count` 미만)
- 후보 `place_id` 중복 예외
- LLM 응답에 특정 `place_id`의 `time_suitability` 누락 시 예외
- LLM 응답에 특정 순서쌍의 `transition_scores` 누락 시 예외
- 점수 범위(0~1) 밖 값 예외
- NaN / Infinity 예외

## 9.2 `test_operating_hours.py`

- Places API 결과가 있으면 그대로 사용
- Places API 결과가 없고 fallback 표에 category가 있으면 fallback 적용
- fallback 표에도 category가 없으면 상시 개방으로 처리하되 최소 체류시간은 유지
- 실제 체류시간이 `min(기본 체류시간, 운영 종료 - 방문 시작)`으로 계산되는지 검증
- 실제 체류시간이 최소 체류시간 미만이면 `None` 반환 검증

## 9.3 `test_score_calculator.py`

- `TimeScore`가 시간대 경계에서 시작 시각 기준으로만 계산되는지 검증 (v5 5.1절)
- `TransitionScore`가 연속 구간 평균으로 계산되는지 검증
- `BalanceScore`가 연속 길이 2 이하일 때 페널티 0인지 검증
- `BalanceScore`가 연속 길이 3, 4, 5일 때 k1=k2=5 기준으로 각각 -5/-20/-45가 되는지 검증
- `CategoryRepeatPenalty`가 동일 category 연속 시 적용되는지 검증
- `BalanceScore`가 0 미만으로 내려가지 않는지 검증
- `TravelScore`가 절대 기준(전체 여행 가능시간 대비)으로 계산되는지 검증
- 총 이동시간이 전체 여행 가능시간을 초과할 때 `TravelScore`가 0으로 clamp되는지 검증
- `TotalScore`가 `w1`, `w2` 가중치를 올바르게 반영하는지 검증
- 모든 계산 함수가 입력을 변경하지 않는지(불변성) 검증

## 9.4 `test_backtracking.py`

- 운영시간 위반 경로가 가지치기되는지 검증
- 최소 체류시간 미달 경로가 가지치기되는지 검증
- 여행 종료시간 초과 경로가 가지치기되는지 검증
- 고정 도착지 도달 불가 경로가 가지치기되는지 검증
- lower-bound 조건으로 조기 가지치기되는지 검증
- **활동·휴식 균형만으로는 절대 경로가 가지치기되지 않는지 검증**
- k=N에서 성공 시 5곳 전체 경로만 비교하는지 검증 (2~4곳 부분 경로 미포함)
- 11시간 일정에서 체류시간 유지 + `free_time_minutes` 기록 검증
- 짧은 일정에서 k 자동 축소 + `excluded_places`/`exclusion_reason` 채움 검증
- `min_visit_count`까지 불가 시 `NoFeasibleRouteError` 검증
- k=N 즉시 성공 시 기존 전체 k 동시 탐색보다 평가 수가 적은지 검증

## 9.5 `test_planner.py`

OpenAI, Places API, Routes API, Qdrant를 Mock 처리한다.

- 정상 흐름 전체 (영업 확인 → 운영시간 → 이동시간 → LLM → 탐색 → 점수 → 선택)
- 영업하지 않는 장소가 대체 장소로 치환되는지 검증
- 대체 실패 시 해당 장소가 제외되고 나머지로 진행되는지 검증
- LLM 실패 시 백트래킹을 호출하지 않는지 검증
- `TotalScore`가 가장 높은 경로가 선택되는지 검증
- `CourseOptimizationResult`의 모든 필드가 채워지는지 검증

## 9.6 `test_llm_client.py`

- 프롬프트에 6.2절 앵커 예시(활동→휴식, category 반복, 정반대 급변, 유사 지속)가 포함되는지 검증
- 정상 JSON 응답 파싱
- 스키마 불일치 시 `InvalidCourseEvaluationError`
- 429/5xx/Timeout 재시도 동작 검증

---

## 10. 완료 조건

아래 조건을 모두 만족하면 구현 완료로 본다.

- `ai/course_optimizer` 폴더가 생성되어 있다.
- ai/semantic_vector/qdrant_repository.py에 Cosine Similarity 검색 함수가 추가되어 있다.
- 상위 서비스의 추천 결과를 `TripInput`/`CandidatePlace`로 변환할 수 있다.
- 장소 표현은 `majorScores` 7차원 벡터만 사용하며, 자유 텍스트 태그를 입력으로 받지 않는다.
- 영업하지 않는 장소를 `ai/semantic_vector`의 Qdrant Detail Vector 기반 Cosine Similarity로 대체한다.
- 운영시간 정보가 없을 때 category 기반 2단계 fallback이 적용된다.
- LLM은 완성 경로별로 호출되지 않고, 전체 탐색에 재사용되는 정보를 1회만 생성한다.
- 전이 점수의 채점 기준이 프롬프트 앵커 예시로 문서화되어 있고, 별도의 결정론적 공식이 없다.
- 백트래킹이 k(방문 수) 우선순위로 탐색하며, 가능한 최대 k의 경로만 최종 비교한다.
- 활동·휴식 균형이 가지치기 조건에 전혀 포함되지 않고, 점수로만 반영된다.
- 균형 점수가 이진 임계값이 아닌 연속 길이 기반 페널티(k1, k2)로 계산된다.
- 이동 효율 점수가 후보 간 상대 비교가 아닌 절대 기준(전체 여행 가능시간 대비)으로 계산된다.
- 종합 점수가 `w1`, `w2` 가중치를 반영하며, 초기값은 0.5/0.5이다.
- 모든 외부 서비스(OpenAI, Places API, Routes API, Qdrant) 테스트는 Mock을 사용한다.
- 모든 pytest가 통과한다.

---

## 11. Cursor 구현 지시사항

1. 후보 장소는 반드시 `majorScores` 7차원 벡터와 `category`로만 표현한다. 자유 텍스트 태그 필드를 새로 만들지 않는다.
2. 완성된 경로마다 LLM을 호출하지 않는다. `llm_client.call_course_evaluation()`은 전체 탐색 과정에서 정확히 1회만 호출되어야 한다.
3. 전이 점수 계산에 결정론적 공식(코드)을 작성하지 않는다. 채점 기준은 `prompt.py`의 프롬프트 문구로만 관리한다.
4. `score_calculator.calculate_balance_score()`는 이진 임계값이 아니라 `k1 * max(0, 연속길이 - 2) ** 2` 형태의 연속 페널티로 구현한다.
5. `backtracking.py`의 가지치기 조건에 activityLevel/restLevel 관련 조건을 절대 추가하지 않는다. 활동·휴식 균형은 오직 `score_calculator.calculate_balance_score()`를 통해서만 반영한다.
6. `score_calculator.calculate_travel_score()`는 후보 경로 간 최대/최소 비교(min-max)가 아니라, `trip`의 전체 여행 가능시간 대비 절대 기준으로 계산한다.
7. k(방문 수) 우선순위 탐색을 사용한다. k=N부터 시도하고, 실행 가능한 경로가 있으면 그 k에서만 비교한다. `min_visit_count`는 k 하한이다.
8. `balance_penalty_k1`, `balance_penalty_k2`, `experience_weight`, `travel_weight`는 하드코딩하지 않고 `config.py`의 설정값으로 관리하며, 기본값을 코드에 그대로 반영한다.
9. `ai/semantic_vector`의 GPT Vision 호출이나 Major Score 계산 로직을 재구현하지 않는다. 대체 장소 검색은 반드시 `ai/semantic_vector`의 기존 Qdrant repository 함수를 호출해서 처리한다.
10. `data/pipeline`을 직접 import하지 않는다. 입력은 항상 `TripInput`을 통해서만 받는다.
11. Public 함수에 type hint와 docstring을 작성한다.
12. 구현 후 전체 pytest를 실행한다.
13. 테스트 실패 시 가지치기 조건이나 점수 공식을 임의로 바꾸지 말고 구현 오류를 수정한다. 특히 "활동·휴식 균형으로 경로가 가지치기되지 않는다"는 테스트가 실패하면, 공식이 아니라 잘못 추가된 가지치기 조건을 의심한다.

---

## 12. 최종 책임 분리

```text
상위 서비스 (추천/후보 조립)
├── 취향 기반 장소 추천
├── 추천 결과 → TripInput 변환
└── ai/course_optimizer 호출

ai/semantic_vector
├── GPT Vision 기반 majorScores/Detail Vector 생성
├── Qdrant Collection 관리
└── Cosine Similarity 검색 함수 제공 (course_optimizer가 재사용)

ai/course_optimizer
├── 영업 확인 + 대체 장소 검색 (semantic_vector 재사용)
├── Places API 운영시간 조회 + fallback
├── Routes API 이동시간 조회
├── LLM 1회 호출 (시간대·전이·활동휴식 평가 정보)
├── 백트래킹 + 가지치기 (물리적 제약만)
├── 점수 계산 (시간대·전이·균형·이동효율·종합)
└── 최종 코스 선택
```

```text
TripInput
        ↓
영업 확인 + 대체
        ↓
운영시간 + 이동시간
        ↓
LLM 1회 호출
        ↓
백트래킹 (물리적 가지치기만)
        ↓
점수 계산 (시간대·전이·균형 → 경험 / 이동효율)
        ↓
TotalScore 최댓값 선택
        ↓
CourseOptimizationResult
```
