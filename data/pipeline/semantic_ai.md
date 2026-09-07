# 관광지 이미지 Semantic Score (data/pipeline 안내)

> **정본 명세는 [`ai/semantic_vector/semantic_ai.md`](../../ai/semantic_vector/semantic_ai.md)이다.**  
> 이 파일은 data 파트 연결 계층 안내용이며, 세부 스펙은 ai 쪽을 따른다.

## Grain 요약 (2026-09 기준)

| 저장소 | 단위 | 용도 |
|--------|------|------|
| `place_image_semantic_vector` | 이미지 | 원본 점수 (온보딩 등) |
| `place_semantic_vector` | 장소 집계 | 백엔드 major_scores 등 |
| Qdrant | **이미지 point** | 장소/코스 추천·대체 검색 |

연결 코드: `semantic_vector_sync.py`, `semantic_score_store.py`.  
추천 place_id 중복 제거: [`ai/place_recommender/place_recommender.md`](../../ai/place_recommender/place_recommender.md).

이미지 단위 Qdrant로 전환 후 재적재:

```bash
python scripts/backfill_semantic_vectors.py --reset-qdrant --reanalyze-all
```
