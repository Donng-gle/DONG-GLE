"""사용자 취향 → Qdrant major(이미지) 검색 → Hidden Score 결합 → Top-N.

이미지 단위 hit을 받은 뒤:
- course_top_n > 0: place_id당 best 이미지만 course_recommendations에 넣는다.
- recommendations: 코스에 들어간 place_id의 이미지 전체를 제외한 뒤
  place당 best 1장만 남긴다.
"""

from __future__ import annotations

from collections.abc import Sequence

from place_recommender.config import PlaceRecommenderConfig
from place_recommender.hidden_score_lookup import (
    HiddenScoreLookup,
    PostgresHiddenScoreLookup,
    StaticHiddenScoreLookup,
)
from place_recommender.models import RecommendRequest, RecommendationItem, RecommendResponse
from place_recommender.scorer import recommendation_score
from semantic_vector.config import SemanticVectorConfig
from semantic_vector.qdrant_repository import SimilarPlaceHit, search_similar_places_by_major_vector
from semantic_vector.vector_builder import build_major_vector


async def recommend_places(
    request: RecommendRequest,
    *,
    config: PlaceRecommenderConfig | None = None,
    semantic_config: SemanticVectorConfig | None = None,
    hidden_lookup: HiddenScoreLookup | None = None,
) -> RecommendResponse:
    """취향 유사 이미지를 검색하고 Hidden Score를 반영해 Top-N을 반환한다."""
    resolved = config or PlaceRecommenderConfig()
    user_scores = request.to_major_scores()
    query_vector = build_major_vector(user_scores)

    fetch_limit = max(
        resolved.candidate_limit,
        request.top_n,
        request.course_top_n,
        1,
    )
    hits = await search_similar_places_by_major_vector(
        query_vector,
        config=_semantic_config(resolved, semantic_config),
        category=request.category,
        exclude_place_ids=set(request.exclude_place_ids),
        limit=fetch_limit,
    )

    lookup = hidden_lookup or _default_hidden_lookup(resolved)
    hidden_scores = lookup.get_scores([hit.place_id for hit in hits])
    ranked = _to_ranked_items(hits, hidden_scores, request, resolved)

    course_items = _select_course_recommendations(ranked, request.course_top_n)
    course_place_ids = {item.place_id for item in course_items}
    place_items = _select_place_recommendations(
        ranked,
        top_n=request.top_n,
        excluded_place_ids=course_place_ids,
    )
    return RecommendResponse(
        recommendations=place_items,
        course_recommendations=course_items,
    )


def _semantic_config(
    recommender_config: PlaceRecommenderConfig,
    semantic_config: SemanticVectorConfig | None,
) -> SemanticVectorConfig:
    if semantic_config is not None:
        return semantic_config
    return SemanticVectorConfig(
        openai_api_key="unused",
        qdrant_url=recommender_config.qdrant_url,
        qdrant_api_key=recommender_config.qdrant_api_key,
        qdrant_collection_name=recommender_config.qdrant_collection_name,
    )


def _default_hidden_lookup(config: PlaceRecommenderConfig) -> HiddenScoreLookup:
    if recommender_config_has_database(config):
        return PostgresHiddenScoreLookup(config.database_url or "")
    return StaticHiddenScoreLookup()


def recommender_config_has_database(config: PlaceRecommenderConfig) -> bool:
    return bool(config.database_url)


def _to_ranked_items(
    hits: Sequence[SimilarPlaceHit],
    hidden_scores: dict[str, float],
    request: RecommendRequest,
    config: PlaceRecommenderConfig,
) -> list[RecommendationItem]:
    items: list[RecommendationItem] = []
    for hit in hits:
        if hit.score < request.min_similarity:
            continue
        hidden = hidden_scores.get(hit.place_id, 0.0)
        items.append(
            RecommendationItem(
                place_id=hit.place_id,
                image_id=hit.image_id,
                image_url=hit.image_url,
                similarity_score=hit.score,
                hidden_score=hidden,
                recommendation_score=recommendation_score(
                    hit.score,
                    hidden,
                    config=config,
                ),
            )
        )
    items.sort(
        key=lambda item: (
            -item.recommendation_score,
            -item.similarity_score,
            item.place_id,
            item.image_id or "",
        )
    )
    return items


def _select_course_recommendations(
    ranked: Sequence[RecommendationItem],
    course_top_n: int,
) -> list[RecommendationItem]:
    """score 순으로 place_id당 최고 이미지만 골라 코스 후보로 쓴다."""
    if course_top_n <= 0:
        return []

    selected: list[RecommendationItem] = []
    seen_places: set[str] = set()
    for item in ranked:
        if item.place_id in seen_places:
            continue
        seen_places.add(item.place_id)
        selected.append(item)
        if len(selected) >= course_top_n:
            break
    return selected


def _select_place_recommendations(
    ranked: Sequence[RecommendationItem],
    *,
    top_n: int,
    excluded_place_ids: set[str],
) -> list[RecommendationItem]:
    """코스에 들어간 place의 이미지는 전부 제외하고, 남은 place당 best 1장만 반환."""
    selected: list[RecommendationItem] = []
    seen_places: set[str] = set()
    for item in ranked:
        if item.place_id in excluded_place_ids:
            continue
        if item.place_id in seen_places:
            continue
        seen_places.add(item.place_id)
        selected.append(item)
        if len(selected) >= top_n:
            break
    return selected
