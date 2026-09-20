"""worthiness 모듈 테스트."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from hidden_score.models import HiddenScoreConfig, PlaceScoreInput
from hidden_score.worthiness import (
    calculate_bayesian_rating,
    calculate_bayesian_worthiness,
    calculate_dataset_mean_rating,
    calculate_worthiness,
    normalize_rating,
)


def test_bayesian_rating_zero_reviews_equals_mean() -> None:
    result = calculate_bayesian_rating(4.8, 0, 4.0, 100.0)
    assert result == 4.0


def test_bayesian_rating_large_reviews_near_actual() -> None:
    result = calculate_bayesian_rating(4.8, 10000, 4.0, 100.0)
    assert abs(result - 4.8) < 0.01


def test_normalize_rating_bounds() -> None:
    assert normalize_rating(1.0) == 0.0
    assert normalize_rating(5.0) == 1.0
    assert normalize_rating(3.0) == 0.5


def test_bayesian_worthiness_from_rating() -> None:
    assert calculate_bayesian_worthiness(3.0) == 0.5


def test_worthiness_equal_blend() -> None:
    config = HiddenScoreConfig()
    worthiness = calculate_worthiness(0.6, 0.8, config)
    assert worthiness == 0.7


def test_gpt_worthiness_required_by_model() -> None:
    with pytest.raises(ValidationError):
        PlaceScoreInput(
            place_id="a",
            name="a",
            rating=4.0,
            review_count=10,
        )


def test_dataset_mean_rating_from_places() -> None:
    places = [
        PlaceScoreInput(
            place_id="a",
            name="a",
            rating=4.0,
            review_count=10,
            gpt_worthiness=0.8,
        ),
        PlaceScoreInput(
            place_id="b",
            name="b",
            rating=5.0,
            review_count=20,
            gpt_worthiness=0.9,
        ),
    ]
    assert calculate_dataset_mean_rating(places) == 4.5


def test_config_dataset_mean_rating_used() -> None:
    config = HiddenScoreConfig(dataset_mean_rating=3.5)
    result = calculate_bayesian_rating(5.0, 0, 3.5, config.minimum_review_count)
    assert result == 3.5
