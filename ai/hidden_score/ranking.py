"""Hidden Score 기준 정렬 및 Top N 반환."""

from __future__ import annotations

from collections.abc import Sequence

from hidden_score.models import HiddenScoreResult


def rank_places(
    results: Sequence[HiddenScoreResult],
) -> list[HiddenScoreResult]:
    """Hidden Score 기준으로 장소를 정렬한다."""
    return sorted(
        results,
        key=lambda item: (
            -item.hidden_score,
            -item.worthiness,
            -item.hiddenness,
            item.place_id,
        ),
    )


def get_top_places(
    results: Sequence[HiddenScoreResult],
    limit: int,
) -> list[HiddenScoreResult]:
    """상위 N개 장소를 반환한다."""
    if limit < 0:
        raise ValueError("limit must be non-negative")
    if limit == 0:
        return []
    return rank_places(results)[:limit]
