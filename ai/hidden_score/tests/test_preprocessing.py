"""preprocessing 모듈 테스트."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from hidden_score.models import PlaceScoreInput, TourismStatisticsInput
from hidden_score.preprocessing import (
    calculate_review_percentiles,
    calculate_tourism_popularity_score,
    prepare_place_inputs,
)


def _place(
    place_id: str,
    review_count: int,
    *,
    review_percentile: float | None = None,
    tps: float | None = None,
    tourism_statistics: TourismStatisticsInput | None = None,
) -> PlaceScoreInput:
    return PlaceScoreInput(
        place_id=place_id,
        name=place_id,
        rating=4.5,
        review_count=review_count,
        review_percentile=review_percentile,
        tps=tps,
        tourism_statistics=tourism_statistics,
        gpt_worthiness=0.8,
    )


def test_empty_percentile_map() -> None:
    assert calculate_review_percentiles([]) == {}


def test_single_place_percentile_is_zero() -> None:
    result = calculate_review_percentiles([_place("a", 10)])
    assert result == {"a": 0.0}


def test_percentile_increases_with_review_count() -> None:
    places = [_place("a", 10), _place("b", 20), _place("c", 100)]
    result = calculate_review_percentiles(places)
    assert result["a"] < result["b"] < result["c"]


def test_tied_review_counts_share_percentile() -> None:
    places = [_place("a", 10), _place("b", 20), _place("c", 20), _place("d", 100)]
    result = calculate_review_percentiles(places)
    assert result["a"] == 0.0
    assert result["b"] == result["c"] == 0.5
    assert result["d"] == 1.0


def test_duplicate_place_id_raises() -> None:
    with pytest.raises(ValueError, match="duplicate place_id"):
        calculate_review_percentiles([_place("a", 10), _place("a", 20)])


def test_tps_zero_when_not_appeared() -> None:
    stats = TourismStatisticsInput(appearance_count=0, average_rank=None)
    assert calculate_tourism_popularity_score(stats) == 0.0


def test_tps_one_when_always_top_rank() -> None:
    stats = TourismStatisticsInput(
        appearance_count=12,
        average_rank=1.0,
        total_months=12,
        ranking_size=100,
    )
    assert calculate_tourism_popularity_score(stats) == 1.0


def test_tps_low_frequency_and_low_rank() -> None:
    stats = TourismStatisticsInput(
        appearance_count=2,
        average_rank=72.0,
        total_months=12,
        ranking_size=100,
    )
    tps = calculate_tourism_popularity_score(stats)
    assert 0.0 < tps < 0.1


def test_tps_within_range() -> None:
    stats = TourismStatisticsInput(
        appearance_count=6,
        average_rank=20.0,
        total_months=12,
        ranking_size=100,
    )
    tps = calculate_tourism_popularity_score(stats)
    assert 0.0 <= tps <= 1.0


def test_explicit_tps_overrides_statistics() -> None:
    place = _place(
        "a",
        50,
        tps=0.42,
        tourism_statistics=TourismStatisticsInput(
            appearance_count=12,
            average_rank=1.0,
        ),
    )
    prepared = prepare_place_inputs([place])
    assert prepared[0].tps == 0.42


def test_partial_percentile_raises() -> None:
    places = [_place("a", 10, review_percentile=0.1), _place("b", 20)]
    with pytest.raises(ValueError, match="review_percentile"):
        prepare_place_inputs(places)


def test_tourism_validation_requires_rank_when_appeared() -> None:
    with pytest.raises(ValidationError):
        TourismStatisticsInput(appearance_count=3, average_rank=None)
