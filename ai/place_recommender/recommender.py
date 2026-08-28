"""사용자 취향 → Qdrant major 검색 → Hidden Score 결합 → Top-N."""

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
    """취향 유사 장소를 검색하고 Hidden Score를 반영해 Top-N을 반환한다."""
    resolved = config or PlaceRecommenderConfig()
    user_scores = request.to_major_scores()
    query_vector = build_major_vector(user_scores)

    hits = await search_similar_places_by_major_vector(
        query_vector,
        config=_semantic_config(resolved, semantic_config),
        category=request.category,
        exclude_place_ids=set(request.exclude_place_ids),
        limit=max(resolved.candidate_limit, request.top_n),
    )

    lookup = hidden_lookup or _default_hidden_lookup(resolved)
    hidden_scores = lookup.get_scores([hit.place_id for hit in hits])
    items = _to_ranked_items(hits, hidden_scores, request, resolved)
    return RecommendResponse(recommendations=items[: request.top_n])


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
        )
    )
    return items
