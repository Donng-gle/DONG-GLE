"""Bayesian 기반 Worthiness 계산."""

from __future__ import annotations

from collections.abc import Sequence

from hidden_score.models import HiddenScoreConfig, PlaceScoreInput
from hidden_score.validators import clamp, ensure_finite


def calculate_dataset_mean_rating(
    places: Sequence[PlaceScoreInput],
) -> float:
    """현재 장소 집합의 평균 Google 평점을 계산한다."""
    if not places:
        raise ValueError("places must not be empty")
    return sum(place.rating for place in places) / len(places)


def calculate_bayesian_rating(
    rating: float,
    review_count: int,
    dataset_mean_rating: float,
    minimum_review_count: float,
) -> float:
    """Bayesian 보정 평점 (1~5)."""
    ensure_finite(rating, "rating")
    ensure_finite(dataset_mean_rating, "dataset_mean_rating")
    ensure_finite(minimum_review_count, "minimum_review_count")

    v = review_count
    m = minimum_review_count
    return (v / (v + m)) * rating + (m / (v + m)) * dataset_mean_rating


def normalize_rating(rating: float) -> float:
    """평점(1~5)을 0~1로 정규화한다."""
    ensure_finite(rating, "rating")
    return clamp((rating - 1.0) / 4.0)


def calculate_bayesian_worthiness(
    bayesian_rating: float,
) -> float:
    """Bayesian Rating을 Worthiness 스케일(0~1)로 변환한다."""
    return normalize_rating(bayesian_rating)


def calculate_worthiness(
    bayesian_worthiness: float,
    gpt_worthiness: float,
    config: HiddenScoreConfig,
) -> float:
    """Bayesian Worthiness와 GPT Worthiness를 결합한다."""
    ensure_finite(bayesian_worthiness, "bayesian_worthiness")
    ensure_finite(gpt_worthiness, "gpt_worthiness")

    worthiness = (
        config.bayesian_worthiness_weight * bayesian_worthiness
        + config.gpt_worthiness_weight * gpt_worthiness
    )
    return clamp(worthiness)
