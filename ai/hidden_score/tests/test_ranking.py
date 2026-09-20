"""ranking 모듈 테스트."""

from __future__ import annotations

import pytest

from hidden_score.models import HiddenScoreResult
from hidden_score.ranking import get_top_places, rank_places


def _result(
    place_id: str,
    hidden_score: float,
    worthiness: float = 0.5,
    hiddenness: float = 0.5,
) -> HiddenScoreResult:
    return HiddenScoreResult(
        place_id=place_id,
        name=place_id,
        rating=4.5,
        review_count=10,
        review_percentile=0.5,
        tps=0.1,
        google_hiddenness=0.5,
        tourism_hiddenness=0.5,
        hiddenness=hiddenness,
        bayesian_rating=4.5,
        bayesian_worthiness=0.5,
        gpt_worthiness=0.5,
        worthiness=worthiness,
        hidden_score=hidden_score,
    )


def test_rank_by_hidden_score_desc() -> None:
    results = [_result("b", 50), _result("a", 80)]
    ranked = rank_places(results)
    assert [r.place_id for r in ranked] == ["a", "b"]


def test_tie_breaker_worthiness() -> None:
    results = [_result("a", 50, worthiness=0.6), _result("b", 50, worthiness=0.8)]
    ranked = rank_places(results)
    assert ranked[0].place_id == "b"


def test_tie_breaker_hiddenness_then_place_id() -> None:
    results = [
        _result("b", 50, worthiness=0.6, hiddenness=0.4),
        _result("a", 50, worthiness=0.6, hiddenness=0.7),
    ]
    ranked = rank_places(results)
    assert ranked[0].place_id == "a"


def test_get_top_places_limit_zero() -> None:
    assert get_top_places([_result("a", 10)], limit=0) == []


def test_get_top_places_limit_exceeds_size() -> None:
    results = [_result("a", 10), _result("b", 20)]
    top = get_top_places(results, limit=5)
    assert len(top) == 2


def test_negative_limit_raises() -> None:
    with pytest.raises(ValueError, match="limit"):
        get_top_places([_result("a", 10)], limit=-1)


def test_rank_does_not_mutate_input() -> None:
    results = [_result("b", 50), _result("a", 80)]
    original = list(results)
    rank_places(results)
    assert results[0].place_id == original[0].place_id
