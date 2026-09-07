# Place Recommender — 이미지 단위 추천

> 정본 벡터 색인 명세: [`ai/semantic_vector/semantic_ai.md`](../semantic_vector/semantic_ai.md)  
> HTTP: `POST /v1/places/recommend` (`ai/api/app.py`)

## 1. 역할

사용자 취향(7차원 major)과 Qdrant **이미지 point**의 major 벡터 유사도를 계산하고,  
`place.hidden_score`와 가중합해 Top-N을 반환한다.

검색 grain은 **이미지**이다. 응답에는 `place_id`와 함께 `image_id` / `image_url`이 포함된다.

## 2. 처리 흐름

```text
RecommendRequest (취향 + top_n + course_top_n)
    │
    ▼
build_major_vector(user prefs)
    │
    ▼
Qdrant major search (이미지 point, over-fetch)
    │
    ▼
recommendation_score = w_sim * similarity + w_hidden * norm(hidden)
    │
    ├─ course_top_n > 0
    │     score 순으로 place_id당 best 이미지만
    │     → course_recommendations (최대 course_top_n)
    │
    └─ recommendations
          course에 들어간 place_id의 이미지 전부 제외
          → 남은 hit에서 place당 best 1장
          → top_n
```

### place_id 중복 제거 규칙

| 목록 | 규칙 |
|------|------|
| `course_recommendations` | 같은 `place_id`는 **가장 잘 맞는 이미지 1장만** |
| `recommendations` | 코스에 이미 들어간 `place_id`의 **나머지 이미지는 넣지 않음**. 그 외 place는 best 이미지 1장 |

예: place=1 이미지 3장, place=2 이미지 2장이 hit되고 `course_top_n=1`이면  
코스에는 place1 best만, 장소 추천에는 place1의 다른 이미지 없이 place2 best만 올 수 있다.

## 3. API 모델

### Request (`RecommendRequest`)

- 취향: flat 7필드 또는 `preferences: [{tag, score}]`
- `top_n`: 장소 추천 개수 (place당 1이미지)
- `course_top_n`: 코스용 place당 best 이미지 개수 (`0`이면 `course_recommendations=[]`)
- `exclude_place_ids`, `category`, `min_similarity`

### Response (`RecommendResponse`)

```json
{
  "recommendations": [
    {
      "place_id": "3",
      "image_id": "3-img1",
      "image_url": "https://...",
      "similarity_score": 0.6,
      "hidden_score": 0.0,
      "recommendation_score": 0.36
    }
  ],
  "course_recommendations": [
    {
      "place_id": "1",
      "image_id": "1-img1",
      "image_url": "https://...",
      "similarity_score": 0.95,
      "hidden_score": 0.0,
      "recommendation_score": 0.57
    }
  ]
}
```

## 4. Qdrant 전제

- Collection: 이미지 단위 point (`build_point_id(place_id, image_id)`)
- payload에 `place_id`, `image_id`, `image_url` 필수
- 장소 단위 구 인덱스와 호환되지 않음 → 전환 시 reset 후 backfill

```bash
python scripts/backfill_semantic_vectors.py --reset-qdrant --reanalyze-all
```

## 5. 관련 코드

| 경로 | 역할 |
|------|------|
| `place_recommender/recommender.py` | 검색·랭킹·코스/장소 분리 |
| `place_recommender/models.py` | 요청/응답 |
| `place_recommender/scorer.py` | 가중합 |
| `semantic_vector/qdrant_repository.py` | 이미지 hit / `dedupe_hits_by_place_id` |
| `course_optimizer/replacement_client.py` | 대체 검색 시 place_id dedupe |
