"""Semantic similarity와 Hidden Score를 결합한다."""

from __future__ import annotations

from place_recommender.config import PlaceRecommenderConfig


def normalize_hidden_score(hidden_score: float, scale: float) -> float:
    """place.hidden_score(0~100)를 0~1로 맞춘다."""
    if scale <= 0:
        return 0.0
    normalized = hidden_score / scale
    return max(0.0, min(1.0, normalized))


def recommendation_score(
    similarity: float,
    hidden_score: float,
    *,
    config: PlaceRecommenderConfig,
) -> float:
    """기존 Qdrant cosine similarity와 저장된 Hidden Score를 가중합한다."""
    hidden = normalize_hidden_score(hidden_score, config.hidden_score_scale)
    return (
        config.similarity_weight * similarity
        + config.hidden_score_weight * hidden
    )
