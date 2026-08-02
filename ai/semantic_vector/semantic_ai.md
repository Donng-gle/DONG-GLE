# 관광지 이미지 Semantic Score 생성 및 Vector DB 저장 기능 구현 명세서

> 이 문서는 이미 구현되어 있는 `data/pipeline`의 관광지·이미지 조회 결과를 입력으로 받아, GPT Vision 기반 태그 점수 생성과 Qdrant 저장 기능만 `ai` 폴더 아래에 구현하기 위한 단일 명세서이다.
>
> `data/pipeline` 내부의 데이터 수집, DB 조회, 이미지 확보 로직은 본 구현 범위에서 제외한다.

---

## 1. 기능 개요

### 1.1 기능명

**관광지 이미지 Semantic Score 생성 및 Qdrant 저장 기능**

### 1.2 목적

기존 `data/pipeline`이 반환하는 관광지 대표 이미지 데이터를 입력으로 받아 다음 작업을 수행한다.

1. GPT Vision에 관광지 이미지를 전달한다.
2. 이미지의 분위기와 시각적 특성을 35개 세부 태그 점수로 생성한다.
3. 35개 세부 태그를 기반으로 7개 대분류 점수를 계산한다.
4. 35차원 Detail Vector와 7차원 Major Vector를 생성한다.
5. 두 벡터를 Qdrant에 named vector로 저장한다.
6. 장소 ID와 검색 필터용 메타데이터를 Qdrant payload에 저장한다.

### 1.3 구현 전제

다음 기능은 이미 `data/pipeline`에 구현되어 있다고 가정한다.

- PostgreSQL 연결
- 관광지 데이터 조회
- 관광지 대표 이미지 조회
- 이미지 URL 또는 이미지 데이터 확보
- 장소 ID 확보
- 장소명, 지역, 카테고리 등 메타데이터 확보
- 이미지가 없는 장소 처리
- 데이터 수집 및 전처리

본 모듈은 위 기능을 다시 구현하지 않는다.

### 1.4 핵심 원칙

- `data/pipeline`의 출력 구조를 입력 계약으로 사용한다.
- 데이터 조회 로직을 `ai` 폴더에 중복 구현하지 않는다.
- GPT는 35개 Detail Score만 생성한다.
- 7개 Major Score는 Python 코드로 계산한다.
- Qdrant에는 `major`, `detail` 두 named vector를 저장한다.
- 7개와 35개 점수를 이어 붙인 42차원 벡터는 생성하지 않는다.
- 35개와 7개 벡터의 순서는 항상 고정한다.
- GPT 응답의 JSON 키 순서에 의존하지 않는다.
- Qdrant 저장 실패와 GPT 분석 실패를 구분한다.
- 동일 장소에 대한 재실행 시 upsert가 가능해야 한다.
- 프롬프트와 태그 스키마에 버전을 부여한다.

---

## 2. 구현 범위

### 2.1 포함 범위

- `data/pipeline` 출력 데이터 수신
- 이미지 입력 정규화
- GPT Vision Prompt 구성
- GPT Vision API 호출
- 구조화 JSON 응답 파싱
- 35개 태그 키 검증
- 태그 점수 범위 검증
- 7개 Major Score 계산
- 35차원 Detail Vector 생성
- 7차원 Major Vector 생성
- Qdrant Collection 생성 및 검증
- Qdrant Point Upsert
- Qdrant Payload 구성
- 단일 장소 처리
- 여러 장소 Batch 처리
- 실패 결과 수집
- 재시도 처리
- 단위 테스트
- Mock 기반 통합 테스트

### 2.2 제외 범위

- PostgreSQL 연결 코드
- 관광지 DB 조회
- 이미지 DB 조회
- TourAPI 호출
- Google Places API 호출
- 이미지 다운로드 Pipeline
- 이미지 유효성 검증 Pipeline
- 장소 정보 정제
- Hidden Score 계산
- 사용자 취향 벡터 생성
- 추천 검색 API
- 추천 순위 계산
- 프론트엔드 UI
- 기존 `data/pipeline` 코드 수정

---

## 3. 전체 처리 흐름

```text
data/pipeline
    │
    │ 기존 Pipeline 결과
    ▼
PlaceImageInput
    │
    ▼
ai/semantic_vector
    │
    ├── Prompt 생성
    ├── GPT Vision 호출
    ├── 35개 Detail Score 검증
    ├── 7개 Major Score 계산
    ├── Detail Vector 생성
    ├── Major Vector 생성
    └── Qdrant Upsert
    │
    ▼
SemanticVectorResult
```

좀 더 구체적인 흐름은 다음과 같다.

```text
data.pipeline.load_places()
        │
        ▼
장소별 대표 이미지 데이터
        │
        ▼
analyze_place()
        │
        ├── Prompt 생성
        ├── GPT Vision 호출
        ├── JSON 응답 파싱
        ├── Detail Score 검증
        ├── Major Score 계산
        ├── Vector 생성
        └── Qdrant 저장
        │
        ▼
분석 성공 / 실패 결과
```

---

## 4. 권장 폴더 구조

`ai` 폴더 안에 새 기능 전용 폴더를 생성한다.

```text
ai/
├── hidden_score/
│   └── ...
│
└── semantic_vector/
    ├── __init__.py
    ├── config.py
    ├── constants.py
    ├── models.py
    ├── prompt.py
    ├── validators.py
    ├── vision_client.py
    ├── score_calculator.py
    ├── vector_builder.py
    ├── qdrant_repository.py
    ├── analyzer.py
    ├── batch.py
    ├── exceptions.py
    ├── semantic_vector.md
    └── tests/
        ├── __init__.py
        ├── test_validators.py
        ├── test_score_calculator.py
        ├── test_vector_builder.py
        ├── test_qdrant_repository.py
        ├── test_analyzer.py
        └── test_batch.py
```

### 4.1 폴더명

권장 폴더명:

```text
ai/semantic_vector
```

이유:

- 이미지 분석 결과를 의미 기반 Vector로 변환하는 기능을 직접적으로 표현한다.
- 향후 사용자 Vector, 리뷰 Vector, CLIP Vector 확장에 대응하기 쉽다.
- `semantic_analysis`보다 Qdrant 저장 목적까지 포함하는 이름이다.

---

## 5. 기존 `data/pipeline`과의 연결 규칙

### 5.1 의존 방향

허용:

```text
ai/semantic_vector
        ↓ import
data/pipeline
```

금지:

```text
data/pipeline
        ↓ import
ai/semantic_vector
```

`data`가 `ai`를 의존하지 않도록 한다.

### 5.2 입력 계약

`data/pipeline`이 반환하는 실제 dict 또는 객체를 그대로 analyzer 내부에서 사용하지 말고, AI 모듈의 입력 모델로 변환한다.

```python
class PlaceImageInput(BaseModel):
    place_id: str
    image_url: str

    image_id: str | None = None
    name: str | None = None
    region: str | None = None
    category: str | None = None
```

기존 Pipeline 필드명이 다를 경우 호출부에서 명시적으로 매핑한다.

예:

```python
input_data = PlaceImageInput(
    place_id=place["content_id"],
    image_id=place.get("image_id"),
    image_url=place["first_image"],
    name=place.get("title"),
    region=place.get("region"),
    category=place.get("content_type"),
)
```

### 5.3 금지 사항

- `ai/semantic_vector` 내부에서 DB Session 생성 금지
- `ai/semantic_vector` 내부에서 관광지 SQL 작성 금지
- `ai/semantic_vector` 내부에서 TourAPI 호출 금지
- 기존 Pipeline과 동일한 이미지 조회 함수 재작성 금지
- `data/pipeline` 내부 구조에 강하게 결합된 dict 접근을 여러 파일에 흩어놓지 않는다

Pipeline 결과 변환은 진입점 한 곳에서만 수행한다.

---

## 6. 각 파일의 역할

## 6.1 `__init__.py`

외부에서 사용할 Public API를 노출한다.

```python
from .analyzer import analyze_place
from .batch import analyze_places
from .models import (
    PlaceImageInput,
    SemanticVectorResult,
    BatchAnalysisResult,
)
```

사용 예:

```python
from ai.semantic_vector import analyze_place, analyze_places
```

---

## 6.2 `config.py`

환경변수 및 설정값을 관리한다.

```python
class SemanticVectorConfig(BaseSettings):
    openai_api_key: str
    openai_model: str = "gpt-4.1-mini"

    qdrant_url: str
    qdrant_api_key: str | None = None
    qdrant_collection_name: str = "place_semantic_vectors"

    prompt_version: str = "semantic-image-v1"
    tag_schema_version: str = "tourism-semantic-tags-v1"

    max_retry_count: int = 3
    batch_concurrency: int = 3
```

환경변수 예:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini

QDRANT_URL=
QDRANT_API_KEY=
QDRANT_COLLECTION_NAME=place_semantic_vectors

SEMANTIC_PROMPT_VERSION=semantic-image-v1
SEMANTIC_TAG_SCHEMA_VERSION=tourism-semantic-tags-v1

SEMANTIC_MAX_RETRY_COUNT=3
SEMANTIC_BATCH_CONCURRENCY=3
```

---

## 6.3 `constants.py`

태그 순서와 그룹 구성을 정의한다.

```python
MAJOR_TAG_ORDER = [
    "relaxing",
    "lively",
    "romantic",
    "local",
    "photogenic",
    "traditional",
    "modern",
]
```

```python
DETAIL_TAG_ORDER = [
    "quiet",
    "peaceful",
    "spacious",
    "nature_friendly",
    "stay_long",

    "crowded",
    "energetic",
    "colorful",
    "dynamic",
    "social",

    "warm_mood",
    "intimate",
    "date_friendly",
    "night_mood",
    "emotional",

    "local_identity",
    "daily_life",
    "authentic",
    "market_alley",
    "hidden_gem",

    "scenic",
    "composition",
    "landmark",
    "viewpoint",
    "photo_spot",

    "traditional_architecture",
    "historical",
    "cultural",
    "natural_material",
    "heritage_mood",

    "modern_architecture",
    "minimal",
    "urban",
    "trendy",
    "artistic",
]
```

```python
DETAIL_TAG_GROUPS = {
    "relaxing": DETAIL_TAG_ORDER[0:5],
    "lively": DETAIL_TAG_ORDER[5:10],
    "romantic": DETAIL_TAG_ORDER[10:15],
    "local": DETAIL_TAG_ORDER[15:20],
    "photogenic": DETAIL_TAG_ORDER[20:25],
    "traditional": DETAIL_TAG_ORDER[25:30],
    "modern": DETAIL_TAG_ORDER[30:35],
}
```

---

## 6.4 `models.py`

입력, GPT 응답, 결과 모델을 정의한다.

### `PlaceImageInput`

```python
class PlaceImageInput(BaseModel):
    place_id: str
    image_url: str

    image_id: str | None = None
    name: str | None = None
    region: str | None = None
    category: str | None = None
```

### `DetailScores`

실제 구현에서는 35개 필드를 모두 선언한다.

```python
class DetailScores(BaseModel):
    quiet: float
    peaceful: float
    spacious: float
    nature_friendly: float
    stay_long: float

    crowded: float
    energetic: float
    colorful: float
    dynamic: float
    social: float

    warm_mood: float
    intimate: float
    date_friendly: float
    night_mood: float
    emotional: float

    local_identity: float
    daily_life: float
    authentic: float
    market_alley: float
    hidden_gem: float

    scenic: float
    composition: float
    landmark: float
    viewpoint: float
    photo_spot: float

    traditional_architecture: float
    historical: float
    cultural: float
    natural_material: float
    heritage_mood: float

    modern_architecture: float
    minimal: float
    urban: float
    trendy: float
    artistic: float
```

### `MajorScores`

```python
class MajorScores(BaseModel):
    relaxing: float
    lively: float
    romantic: float
    local: float
    photogenic: float
    traditional: float
    modern: float
```

### `VisionAnalysisResponse`

```python
class VisionAnalysisResponse(BaseModel):
    detail_scores: DetailScores
    summary: str | None = None
```

### `SemanticVectorResult`

```python
class SemanticVectorResult(BaseModel):
    place_id: str
    image_id: str | None

    detail_scores: DetailScores
    major_scores: MajorScores

    detail_vector: list[float]
    major_vector: list[float]

    summary: str | None

    model_name: str
    prompt_version: str
    tag_schema_version: str

    qdrant_point_id: str
```

### `BatchAnalysisFailure`

```python
class BatchAnalysisFailure(BaseModel):
    place_id: str
    error_type: str
    error_message: str
```

### `BatchAnalysisResult`

```python
class BatchAnalysisResult(BaseModel):
    total_count: int
    success_count: int
    failed_count: int

    results: list[SemanticVectorResult]
    failures: list[BatchAnalysisFailure]
```

---

## 6.5 `prompt.py`

GPT Vision Prompt를 관리한다.

### 요구사항

- Prompt 본문은 이 파일에서만 관리한다.
- 35개 태그 정의를 포함한다.
- 각 점수 범위를 명시한다.
- 태그 점수는 독립적임을 명시한다.
- JSON 이외의 출력 금지를 명시한다.
- 장소명만 보고 추론하지 않도록 지시한다.
- 이미지에서 보이는 요소만 평가하도록 한다.

### System Prompt 예시

```text
당신은 관광지 이미지의 분위기와 시각적 특성을 정량화하는 분석 모델이다.

주어진 이미지에서 확인되는 시각적 특징만을 근거로
정의된 35개 세부 태그 각각에 대해 0.0부터 1.0 사이의 점수를 반환하라.

0.0은 해당 특성이 거의 보이지 않음을 의미한다.
1.0은 해당 특성이 매우 강하게 보임을 의미한다.

각 점수는 서로 독립적이며 전체 합을 1로 맞추지 않는다.

장소명이나 일반 지식을 근거로 이미지에 보이지 않는 특성을 추정하지 않는다.
35개 태그를 모두 반환한다.
태그를 누락하거나 추가하지 않는다.
지정된 JSON Schema에 맞는 JSON만 반환한다.
```

### User Prompt 예시

```text
장소명: {name}
지역: {region}
카테고리: {category}

첨부된 관광지 이미지를 분석하여 35개 세부 태그 점수를 생성하라.
```

---

## 6.6 `validators.py`

GPT 응답과 벡터를 검증한다.

### `validate_score()`

```python
def validate_score(
    value: float,
    field_name: str,
) -> float:
    ...
```

규칙:

- 숫자여야 한다.
- `NaN`, `inf`, `-inf` 금지
- `0.0 <= value <= 1.0`
- 자동 clamp 금지

### `validate_detail_score_keys()`

```python
def validate_detail_score_keys(
    scores: Mapping[str, float],
) -> None:
    ...
```

규칙:

- 정확히 35개
- `DETAIL_TAG_ORDER`와 키 집합 일치
- 누락 태그 금지
- 추가 태그 금지

### `validate_vector_dimensions()`

```python
def validate_vector_dimensions(
    detail_vector: Sequence[float],
    major_vector: Sequence[float],
) -> None:
    ...
```

규칙:

```text
len(detail_vector) == 35
len(major_vector) == 7
```

---

## 6.7 `vision_client.py`

OpenAI Vision 호출만 담당한다.

```python
async def analyze_image_with_vision(
    input_data: PlaceImageInput,
    *,
    config: SemanticVectorConfig,
) -> VisionAnalysisResponse:
    ...
```

### 책임

- Prompt 조합
- 이미지 URL 전달
- OpenAI API 호출
- Structured Output 요청
- 응답 파싱
- API 오류 변환
- 재시도 대상 오류 식별

### 금지

- Major Score 계산
- Qdrant 저장
- Batch 처리
- Pipeline 데이터 조회
- 장소 데이터 변환

---

## 6.8 `score_calculator.py`

35개 Detail Score로 7개 Major Score를 계산한다.

```python
def calculate_major_scores(
    detail_scores: DetailScores,
) -> MajorScores:
    ...
```

### 공식

각 Major Score는 소속 Detail Score 5개의 산술평균이다.

```text
major_score
=
(detail_1 + detail_2 + detail_3 + detail_4 + detail_5)
/
5
```

예:

```text
relaxing
=
(
    quiet
    + peaceful
    + spacious
    + nature_friendly
    + stay_long
)
/
5
```

### 규칙

- 7개 그룹 모두 계산
- 내부 계산 중 반올림 금지
- 동일 입력에 동일 출력
- 입력 객체 직접 수정 금지
- 임의 가중치 추가 금지

---

## 6.9 `vector_builder.py`

고정된 태그 순서로 벡터를 생성한다.

### Detail Vector

```python
def build_detail_vector(
    detail_scores: DetailScores,
) -> list[float]:
    return [
        getattr(detail_scores, tag)
        for tag in DETAIL_TAG_ORDER
    ]
```

### Major Vector

```python
def build_major_vector(
    major_scores: MajorScores,
) -> list[float]:
    return [
        getattr(major_scores, tag)
        for tag in MAJOR_TAG_ORDER
    ]
```

### 중요 원칙

- GPT JSON의 키 순서에 의존하지 않는다.
- dict 삽입 순서에 의존하지 않는다.
- 반드시 고정 상수를 사용한다.
- Detail Vector는 정확히 35차원이다.
- Major Vector는 정확히 7차원이다.

---

## 6.10 `qdrant_repository.py`

Qdrant Collection과 Point 저장만 담당한다.

### Collection 이름

```python
DEFAULT_COLLECTION_NAME = "place_semantic_vectors"
```

### Named Vector 구성

```python
vectors_config = {
    "major": VectorParams(
        size=7,
        distance=Distance.COSINE,
    ),
    "detail": VectorParams(
        size=35,
        distance=Distance.COSINE,
    ),
}
```

### Public 함수

```python
async def ensure_collection_exists(
    config: SemanticVectorConfig,
) -> None:
    ...
```

```python
async def upsert_semantic_vector(
    result: SemanticVectorResult,
    input_data: PlaceImageInput,
    *,
    config: SemanticVectorConfig,
) -> None:
    ...
```

```python
async def delete_semantic_vector(
    point_id: str,
    *,
    config: SemanticVectorConfig,
) -> None:
    ...
```

### Collection 검증

기존 Collection이 있는 경우 다음 설정이 맞는지 확인한다.

```text
major.size == 7
detail.size == 35
major.distance == COSINE
detail.distance == COSINE
```

설정이 다르면 자동 삭제하지 말고 오류를 발생시킨다.

---

## 7. Qdrant 저장 구조

### 7.1 Point ID

장소당 하나의 대표 Vector만 저장한다면 `place_id`를 Point ID로 사용할 수 있다.

권장:

```text
point_id = place_id
```

장소 ID가 Qdrant Point ID 형식과 맞지 않으면 UUID를 안정적으로 생성한다.

```python
uuid5(NAMESPACE_URL, place_id)
```

### 7.2 Named Vector

```json
{
  "major": [7개의 숫자],
  "detail": [35개의 숫자]
}
```

### 7.3 Payload

```json
{
  "place_id": "place-1001",
  "image_id": "image-9001",
  "name": "안동 하회마을",
  "region": "안동",
  "category": "관광지",
  "model_name": "gpt-4.1-mini",
  "prompt_version": "semantic-image-v1",
  "tag_schema_version": "tourism-semantic-tags-v1"
}
```

### 7.4 전체 Point 예시

```json
{
  "id": "place-1001",
  "vectors": {
    "major": [
      0.83,
      0.24,
      0.56,
      0.72,
      0.86,
      0.92,
      0.21
    ],
    "detail": [
      0.91, 0.88, 0.72, 0.85, 0.79,
      0.14, 0.22, 0.41, 0.18, 0.26,
      0.66, 0.58, 0.73, 0.12, 0.71,
      0.84, 0.63, 0.89, 0.08, 0.78,
      0.92, 0.81, 0.74, 0.77, 0.88,
      0.95, 0.91, 0.87, 0.93, 0.94,
      0.11, 0.23, 0.09, 0.17, 0.46
    ]
  },
  "payload": {
    "place_id": "place-1001",
    "image_id": "image-9001",
    "name": "안동 하회마을",
    "region": "안동",
    "category": "관광지",
    "model_name": "gpt-4.1-mini",
    "prompt_version": "semantic-image-v1",
    "tag_schema_version": "tourism-semantic-tags-v1"
  }
}
```

---

## 8. `analyzer.py`

전체 단일 장소 분석 흐름을 조정한다.

### Public 함수

```python
async def analyze_place(
    input_data: PlaceImageInput,
    *,
    config: SemanticVectorConfig | None = None,
) -> SemanticVectorResult:
    ...
```

### 처리 순서

```text
PlaceImageInput 검증
    ↓
GPT Vision 호출
    ↓
VisionAnalysisResponse 검증
    ↓
35개 Detail Score 확보
    ↓
7개 Major Score 계산
    ↓
35차원 Detail Vector 생성
    ↓
7차원 Major Vector 생성
    ↓
Qdrant Collection 확인
    ↓
Qdrant Upsert
    ↓
SemanticVectorResult 반환
```

### 의사 코드

```python
async def analyze_place(
    input_data: PlaceImageInput,
    *,
    config: SemanticVectorConfig | None = None,
) -> SemanticVectorResult:
    resolved_config = config or SemanticVectorConfig()

    response = await analyze_image_with_vision(
        input_data,
        config=resolved_config,
    )

    major_scores = calculate_major_scores(
        response.detail_scores
    )

    detail_vector = build_detail_vector(
        response.detail_scores
    )

    major_vector = build_major_vector(
        major_scores
    )

    validate_vector_dimensions(
        detail_vector,
        major_vector,
    )

    result = SemanticVectorResult(
        place_id=input_data.place_id,
        image_id=input_data.image_id,
        detail_scores=response.detail_scores,
        major_scores=major_scores,
        detail_vector=detail_vector,
        major_vector=major_vector,
        summary=response.summary,
        model_name=resolved_config.openai_model,
        prompt_version=resolved_config.prompt_version,
        tag_schema_version=resolved_config.tag_schema_version,
        qdrant_point_id=build_point_id(input_data.place_id),
    )

    await ensure_collection_exists(resolved_config)

    await upsert_semantic_vector(
        result,
        input_data,
        config=resolved_config,
    )

    return result
```

---

## 9. `batch.py`

기존 Pipeline의 여러 장소 결과를 일괄 처리한다.

### Public 함수

```python
async def analyze_places(
    places: Sequence[PlaceImageInput],
    *,
    concurrency: int | None = None,
    config: SemanticVectorConfig | None = None,
) -> BatchAnalysisResult:
    ...
```

### 처리 규칙

- 빈 입력이면 빈 결과 반환
- 기본 동시 실행 수는 설정값 사용
- `asyncio.Semaphore`로 동시 실행 제한
- 한 장소 실패가 전체 작업을 중단시키지 않음
- 성공과 실패를 각각 수집
- 입력 순서 유지가 필요하면 인덱스를 함께 관리
- Collection 생성은 Batch 시작 시 1회만 실행
- 장소마다 Collection 존재 여부를 반복 조회하지 않는다

### Batch 흐름

```text
data/pipeline 결과
        ↓
PlaceImageInput 목록으로 변환
        ↓
ensure_collection_exists() 1회
        ↓
Semaphore 기반 병렬 분석
        ↓
성공 결과 수집
실패 결과 수집
        ↓
BatchAnalysisResult
```

---

## 10. 실행 진입점 예시

기존 Pipeline의 정확한 함수명과 반환 필드에 맞게 호출부만 수정한다.

```python
import asyncio

from data.pipeline.load_places import load_places
from ai.semantic_vector import (
    PlaceImageInput,
    analyze_places,
)


async def main() -> None:
    raw_places = load_places()

    inputs = [
        PlaceImageInput(
            place_id=str(place["id"]),
            image_id=(
                str(place["image_id"])
                if place.get("image_id") is not None
                else None
            ),
            image_url=place["image_url"],
            name=place.get("name"),
            region=place.get("region"),
            category=place.get("category"),
        )
        for place in raw_places
    ]

    result = await analyze_places(inputs)

    print(f"success: {result.success_count}")
    print(f"failed: {result.failed_count}")


if __name__ == "__main__":
    asyncio.run(main())
```

### 중요

위 코드는 연결 예시다.

Cursor는 실제 `data/pipeline`의 함수명과 반환 필드를 확인한 후 매핑해야 하며, Pipeline 자체를 수정하지 않는다.

---

## 11. 오류 처리 정책

| 상황 | 처리 |
|---|---|
| `place_id` 누락 | Pydantic validation error |
| `image_url` 누락 | Pydantic validation error |
| GPT 인증 오류 | 즉시 실패 |
| GPT 429 | 재시도 |
| GPT 5xx | 재시도 |
| GPT Timeout | 재시도 |
| JSON 파싱 실패 | `InvalidVisionResponseError` |
| 태그 누락 | `TagSchemaMismatchError` |
| 알 수 없는 태그 추가 | `TagSchemaMismatchError` |
| 점수 범위 오류 | validation error |
| Detail Vector 길이 오류 | `VectorDimensionError` |
| Major Vector 길이 오류 | `VectorDimensionError` |
| Qdrant 연결 실패 | `QdrantIndexError` |
| 한 장소 실패 | Batch 실패 목록에 추가 |
| 동일 place ID 재실행 | Qdrant upsert로 갱신 |

---

## 12. 재시도 정책

### 재시도 대상

- OpenAI HTTP 429
- OpenAI HTTP 5xx
- OpenAI Timeout
- Qdrant 일시적 연결 오류

### 재시도하지 않는 오류

- 인증 오류
- 입력 모델 오류
- JSON Schema 불일치
- 태그 누락
- 점수 범위 오류
- Vector 차원 오류

### 기본값

```text
최대 3회
1초 → 2초 → 4초
```

---

## 13. 테스트 요구사항

## 13.1 `test_validators.py`

- 정상 35개 태그 통과
- 태그 1개 누락 예외
- 추가 태그 예외
- 음수 점수 예외
- 1 초과 점수 예외
- NaN 예외
- Infinity 예외
- Detail Vector 35차원 검증
- Major Vector 7차원 검증

## 13.2 `test_score_calculator.py`

- 각 Major Score가 5개 평균인지 검증
- 7개 Major Score 모두 생성
- 동일 입력에 동일 출력
- 입력 객체 불변
- 반올림되지 않는지 검증

## 13.3 `test_vector_builder.py`

- Detail Vector 길이 35
- Major Vector 길이 7
- 고정 순서 검증
- GPT JSON 순서가 달라도 같은 Vector 생성
- 태그 순서 상수 변경 없이 동작

## 13.4 `test_qdrant_repository.py`

- Collection이 없으면 생성
- Collection이 있으면 재생성하지 않음
- `major.size == 7`
- `detail.size == 35`
- Cosine 설정
- named vector upsert
- payload 저장
- 동일 place ID upsert 갱신
- 잘못된 Collection 설정 감지

## 13.5 `test_analyzer.py`

OpenAI와 Qdrant를 Mock 처리한다.

- 정상 분석 전체 흐름
- GPT 응답 검증
- Major Score 계산 호출
- Vector Builder 호출
- Qdrant Upsert 호출
- GPT 실패 시 Qdrant 호출하지 않음
- Vector 생성 실패 시 Qdrant 호출하지 않음
- SemanticVectorResult 필드 검증

## 13.6 `test_batch.py`

- 빈 입력
- 여러 장소 성공
- 일부 장소 실패
- 전체 장소 실패
- 성공·실패 수 집계
- Semaphore 동시 실행 제한
- Collection 생성 1회 호출

---

## 14. 완료 조건

아래 조건을 모두 만족하면 구현 완료로 본다.

- `ai/semantic_vector` 폴더가 생성되어 있다.
- `data/pipeline` 코드는 수정하지 않는다.
- 기존 Pipeline 결과를 `PlaceImageInput`으로 변환할 수 있다.
- GPT Vision Prompt가 구현되어 있다.
- 35개 Detail Score를 구조화된 JSON으로 받는다.
- 35개 태그 누락과 추가 태그를 검증한다.
- 모든 점수 범위를 검증한다.
- 7개 Major Score를 코드로 계산한다.
- 35차원 Detail Vector를 생성한다.
- 7차원 Major Vector를 생성한다.
- Qdrant Collection에 named vector `major`, `detail`을 생성한다.
- 장소별 Point를 Qdrant에 upsert한다.
- Payload에 장소 식별자와 버전을 저장한다.
- 동일 장소 재실행 시 기존 Point를 갱신한다.
- Batch 분석이 가능하다.
- 한 장소 실패가 전체 Batch를 중단시키지 않는다.
- 모든 외부 서비스 테스트는 Mock을 사용한다.
- 모든 pytest가 통과한다.

---

## 15. Cursor 구현 지시사항

1. 기존 `data/pipeline`을 데이터 입력 Source로 사용한다.
2. 데이터 조회 Pipeline을 새로 구현하지 않는다.
3. 기존 Pipeline 파일을 임의로 수정하지 않는다.
4. `ai/semantic_vector` 내부는 AI 분석과 Qdrant 저장만 담당한다.
5. Pipeline 결과를 `PlaceImageInput`으로 변환하는 코드는 진입점 한 곳에 둔다.
6. GPT는 35개 Detail Score만 생성한다.
7. 7개 Major Score는 Python 코드로 계산한다.
8. `DETAIL_TAG_ORDER`와 `MAJOR_TAG_ORDER`를 반드시 사용한다.
9. GPT JSON 키 순서에 의존하지 않는다.
10. 7개와 35개를 42차원 하나로 합치지 않는다.
11. Qdrant named vector `major`, `detail`을 사용한다.
12. Collection 설정이 다를 때 자동 삭제하지 않는다.
13. 잘못된 점수를 임의 clamp하지 않는다.
14. 한 장소의 실패가 Batch 전체를 중단시키지 않도록 한다.
15. Public 함수에 type hint와 docstring을 작성한다.
16. 구현 후 전체 pytest를 실행한다.
17. 테스트 실패 시 태그 수나 Vector 차원을 변경하지 말고 구현 오류를 수정한다.

---

## 16. 최종 책임 분리

```text
data/pipeline
├── DB 조회
├── 장소 저장 (load_places.py)
├── main_image_url 확보
├── PlaceImageInput 변환 (semantic_vector_sync.py)
└── ai/semantic_vector 호출

ai/semantic_vector
├── Prompt 구성
├── GPT Vision 호출
├── 35개 Detail Score 검증
├── 7개 Major Score 계산
├── 35차원 Detail Vector 생성
├── 7차원 Major Vector 생성
├── Qdrant Collection 관리
└── Qdrant Upsert
```

```text
기존 Pipeline 결과
        ↓
PlaceImageInput
        ↓
GPT Vision
        ↓
35 Detail Scores
        ↓
7 Major Scores
        ↓
major vector + detail vector
        ↓
Qdrant
```

---

## 17. DB Pipeline 연결 (구현 완료)

`data/pipeline`과 `ai/semantic_vector`는 아래 계층으로 연결한다.

```text
data/pipeline/semantic_vector_sync.py
scripts/backfill_semantic_vectors.py
        ↓
ai/semantic_vector.analyze_places()
```

### 17.1 Public API

```python
from semantic_vector import (
    PlaceImageInput,
    analyze_place,
    analyze_places,
    map_place_to_semantic_input,
    place_image_input_from_db_place,
)
```

Pipeline 연결 계층:

```python
from pipeline.semantic_vector_sync import (
    analyze_saved_places,
    load_places_for_semantic_backfill,
    run_semantic_vector_sync,
)
```

### 17.2 입력 매핑

- DB place → `PlaceImageInput` 변환은 `input_mapper.py` 한 곳에서 처리한다.
- `map_place_to_semantic_input(place)`는 `main_image_url`이 없으면 `None`을 반환한다.
- `place.id`를 `place_id` 문자열로 사용한다.
- VLM 프롬프트에는 장소명/지역을 전달하지 않는 기존 정책을 유지한다.

### 17.3 신규 장소 자동 분석

`load_places.py` 흐름:

```text
TourAPI raw 적재
    ↓
PostgreSQL place upsert (commit)
    ↓
main_image_url 있는 place만 PlaceImageInput 변환
    ↓
run_semantic_vector_sync()
    ↓
Qdrant upsert
```

- DB 저장과 VLM 분석은 분리한다.
- VLM 실패 시 place DB 저장은 유지한다.
- 필요 시 `python -m pipeline.load_places --skip-semantic`으로 분석을 생략할 수 있다.

### 17.4 Backfill

기존 DB 장소를 Qdrant에 일괄 저장:

```bash
PYTHONPATH=data:ai python scripts/backfill_semantic_vectors.py
```

옵션:

```bash
python scripts/backfill_semantic_vectors.py --batch-size 50
python scripts/backfill_semantic_vectors.py --limit 20
python scripts/backfill_semantic_vectors.py --place-id 123
```

### 17.5 Qdrant Payload

현재 Payload 필드:

```text
place_id
image_id
image_url
name
region
category
model_name
prompt_version
tag_schema_version
```

- Vector 구조는 `major(7)` + `detail(35)` named vector를 유지한다.
- 같은 `place_id` 재분석 시 upsert로 갱신한다.
- `image_type`은 MVP에서 Payload에 저장하지 않는다. (프롬프트 내부 FOOD/SPACE 분기만 사용)

### 17.6 MVP 정책

- 분석 이미지는 `place.main_image_url` 한 장만 사용한다.
- `detailImage2` 추가 이미지는 수집·분석하지 않는다.
- Qdrant Payload 기반 재분석 skip 최적화는 2차 작업으로 둔다.

### 17.7 테스트 위치

- `ai/semantic_vector/tests/`: AI 모듈 단위 테스트
- `data/tests/`: Pipeline 연결 / Backfill / load_places 연동 테스트
