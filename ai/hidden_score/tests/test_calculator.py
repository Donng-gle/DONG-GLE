"""calculator 모듈 테스트."""

from __future__ import annotations

import pytest

from hidden_score.calculator import calculate_hidden_score, calculate_hidden_scores
from hidden_score.models import HiddenScoreConfig, PlaceScoreInput, TourismStatisticsInput


def _sample_places() -> list[PlaceScoreInput]:
    return [
        PlaceScoreInput(
            place_id="place-a",
            name="안동 숨은 정원",
            rating=4.8,
            review_count=80,
            tourism_statistics=TourismStatisticsInput(
                appearance_count=2,
                average_rank=72.0,
            ),
            gpt_worthiness=0.91,
        ),
        PlaceScoreInput(
            place_id="place-b",
            name="유명 관광지",
            rating=4.6,
            review_count=2500,
            tourism_statistics=TourismStatisticsInput(
                appearance_count=12,
                average_rank=5.0,
            ),
            gpt_worthiness=0.88,
        ),
    ]


def test_calculate_hidden_scores_returns_all_fields() -> None:
    results = calculate_hidden_scores(_sample_places())
    assert len(results) == 2
    result = results[0]
    assert result.place_id == "place-a"
    assert 0.0 <= result.hidden_score <= 100.0
    assert 0.0 <= result.hiddenness <= 1.0
    assert 0.0 <= result.worthiness <= 1.0
    assert result.review_percentile is not None
    assert result.tps is not None


def test_single_place_requires_percentile_and_tps() -> None:
    place = PlaceScoreInput(
        place_id="a",
        name="a",
        rating=4.0,
        review_count=10,
        gpt_worthiness=0.8,
    )
    config = HiddenScoreConfig()
    with pytest.raises(ValueError, match="review_percentile"):
        calculate_hidden_score(place, config=config, dataset_mean_rating=4.0)


def test_empty_input_returns_empty_list() -> None:
    assert calculate_hidden_scores([]) == []


def test_input_order_preserved() -> None:
    results = calculate_hidden_scores(_sample_places())
    assert [r.place_id for r in results] == ["place-a", "place-b"]


def test_original_input_not_mutated() -> None:
    places = _sample_places()
    original_percentile = places[0].review_percentile
    calculate_hidden_scores(places)
    assert places[0].review_percentile == original_percentile


def test_deterministic_output() -> None:
    first = calculate_hidden_scores(_sample_places())
    second = calculate_hidden_scores(_sample_places())
    assert first[0].hidden_score == second[0].hidden_score


def test_hidden_place_scores_higher_than_famous_place() -> None:
    results = calculate_hidden_scores(_sample_places())
    hidden = next(r for r in results if r.place_id == "place-a")
    famous = next(r for r in results if r.place_id == "place-b")
    assert hidden.hidden_score > famous.hidden_score
