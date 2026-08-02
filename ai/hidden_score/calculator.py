"""Hidden Score 핵심 계산 진입점."""

from __future__ import annotations

from collections.abc import Sequence

from hidden_score.hiddenness import (
    calculate_google_hiddenness,
    calculate_hiddenness,
    calculate_tourism_hiddenness,
)
from hidden_score.models import HiddenScoreConfig, HiddenScoreResult, PlaceScoreInput
from hidden_score.preprocessing import prepare_place_inputs
from hidden_score.worthiness import (
    calculate_bayesian_rating,
    calculate_bayesian_worthiness,
    calculate_dataset_mean_rating,
    calculate_worthiness,
)


def calculate_hidden_score(
    place: PlaceScoreInput,
    *,
    config: HiddenScoreConfig,
    dataset_mean_rating: float,
) -> HiddenScoreResult:
    """단일 장소의 Hidden Score를 계산한다."""
    if place.review_percentile is None:
        raise ValueError("review_percentile is required")
    if place.tps is None:
        raise ValueError("tps is required")

    google_h = calculate_google_hiddenness(place.review_percentile)
    tourism_h = calculate_tourism_hiddenness(place.tps)
    hiddenness = calculate_hiddenness(google_h, tourism_h, config)

    bayesian_rating = calculate_bayesian_rating(
        place.rating,
        place.review_count,
        dataset_mean_rating,
        config.minimum_review_count,
    )
    bayesian_worthiness = calculate_bayesian_worthiness(bayesian_rating)
    worthiness = calculate_worthiness(
        bayesian_worthiness,
        place.gpt_worthiness,
        config,
    )

    hidden_score = config.score_scale * hiddenness * worthiness

    return HiddenScoreResult(
        place_id=place.place_id,
        name=place.name,
        rating=place.rating,
        review_count=place.review_count,
        review_percentile=place.review_percentile,
        tps=place.tps,
        google_hiddenness=google_h,
        tourism_hiddenness=tourism_h,
        hiddenness=hiddenness,
        bayesian_rating=bayesian_rating,
        bayesian_worthiness=bayesian_worthiness,
        gpt_worthiness=place.gpt_worthiness,
        worthiness=worthiness,
        hidden_score=hidden_score,
    )


def calculate_hidden_scores(
    places: Sequence[PlaceScoreInput],
    config: HiddenScoreConfig | None = None,
) -> list[HiddenScoreResult]:
    """여러 장소의 Hidden Score를 일괄 계산한다."""
    if not places:
        return []

    resolved_config = config or HiddenScoreConfig()
    prepared = prepare_place_inputs(places)

    if resolved_config.dataset_mean_rating is not None:
        dataset_mean_rating = resolved_config.dataset_mean_rating
    else:
        dataset_mean_rating = calculate_dataset_mean_rating(prepared)

    return [
        calculate_hidden_score(
            place,
            config=resolved_config,
            dataset_mean_rating=dataset_mean_rating,
        )
        for place in prepared
    ]
