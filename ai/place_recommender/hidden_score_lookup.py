"""Postgres place.hidden_score 조회. 기존 Hidden Score 산출값을 재사용한다."""

from __future__ import annotations

from collections.abc import Mapping, Sequence


class HiddenScoreLookup:
    def get_scores(self, place_ids: Sequence[str]) -> dict[str, float]:
        raise NotImplementedError


class StaticHiddenScoreLookup(HiddenScoreLookup):
    def __init__(self, scores: Mapping[str, float] | None = None) -> None:
        self._scores = dict(scores or {})

    def get_scores(self, place_ids: Sequence[str]) -> dict[str, float]:
        return {place_id: self._scores.get(place_id, 0.0) for place_id in place_ids}


class PostgresHiddenScoreLookup(HiddenScoreLookup):
    def __init__(self, database_url: str) -> None:
        self._database_url = database_url

    def get_scores(self, place_ids: Sequence[str]) -> dict[str, float]:
        if not place_ids:
            return {}

        numeric_ids: list[int] = []
        for place_id in place_ids:
            try:
                numeric_ids.append(int(place_id))
            except ValueError:
                continue
        if not numeric_ids:
            return {place_id: 0.0 for place_id in place_ids}

        import psycopg2

        scores: dict[str, float] = {place_id: 0.0 for place_id in place_ids}
        with psycopg2.connect(self._database_url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, hidden_score
                    FROM place
                    WHERE id = ANY(%s)
                    """,
                    (numeric_ids,),
                )
                for place_id, hidden_score in cur.fetchall():
                    if hidden_score is None:
                        continue
                    scores[str(place_id)] = float(hidden_score)
        return scores
