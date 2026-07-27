"""Review Percentile 및 TPS 전처리."""

from __future__ import annotations

from collections.abc import Sequence

from hidden_score.models import PlaceScoreInput, TourismStatisticsInput
from hidden_score.validators import clamp


def calculate_review_percentiles(
    places: Sequence[PlaceScoreInput],
) -> dict[str, float]:
    """장소 집합 기준 리뷰 수 백분위를 계산한다."""
    if not places:
        return {}

    place_ids = [place.place_id for place in places]
    if len(place_ids) != len(set(place_ids)):
        raise ValueError("duplicate place_id")

    if len(places) == 1:
        return {places[0].place_id: 0.0}

    sorted_places = sorted(places, key=lambda p: p.review_count)
    n = len(sorted_places)
    review_to_avg_rank: dict[int, float] = {}
    index = 0
    while index < n:
        review_count = sorted_places[index].review_count
        tie_end = index
        while tie_end < n and sorted_places[tie_end].review_count == review_count:
            tie_end += 1
        avg_rank = (index + 1 + tie_end) / 2
        review_to_avg_rank[review_count] = avg_rank
        index = tie_end

    percentiles: dict[str, float] = {}
    for place in places:
        avg_rank = review_to_avg_rank[place.review_count]
        percentile = (avg_rank - 1) / max(n - 1, 1)
        percentiles[place.place_id] = clamp(percentile)

    return percentiles


def calculate_tourism_popularity_score(
    statistics: TourismStatisticsInput,
) -> float:
    """Tourism Popularity Score (0~1)를 계산한다."""
    if statistics.appearance_count == 0:
        return 0.0

    frequency_score = statistics.appearance_count / statistics.total_months
    rank_score = (
        statistics.ranking_size - statistics.average_rank  # type: ignore[operator]
    ) / (statistics.ranking_size - 1)

    return clamp(frequency_score * rank_score)


def prepare_place_inputs(
    places: Sequence[PlaceScoreInput],
) -> list[PlaceScoreInput]:
    """percentile 및 TPS를 보강한 입력 목록을 반환한다."""
    if not places:
        return []

    place_ids = [place.place_id for place in places]
    if len(place_ids) != len(set(place_ids)):
        raise ValueError("duplicate place_id")

    has_percentile = [place.review_percentile is not None for place in places]
    if any(has_percentile) and not all(has_percentile):
        raise ValueError("review_percentile must be provided for all places or none")

    if all(has_percentile):
        percentile_map = {
            place.place_id: place.review_percentile  # type: ignore[misc]
            for place in places
        }
    else:
        percentile_map = calculate_review_percentiles(places)

    prepared: list[PlaceScoreInput] = []
    for place in places:
        if place.tps is not None:
            tps = place.tps
        elif place.tourism_statistics is not None:
            tps = calculate_tourism_popularity_score(place.tourism_statistics)
        else:
            tps = 0.0

        prepared.append(
            place.model_copy(
                update={
                    "review_percentile": percentile_map[place.place_id],
                    "tps": tps,
                }
            )
        )

    return prepared
