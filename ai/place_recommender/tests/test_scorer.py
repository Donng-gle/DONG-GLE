from place_recommender.config import PlaceRecommenderConfig
from place_recommender.scorer import normalize_hidden_score, recommendation_score


def _config() -> PlaceRecommenderConfig:
    return PlaceRecommenderConfig(
        qdrant_url="http://localhost:6333",
        similarity_weight=0.6,
        hidden_score_weight=0.4,
    )


def test_normalize_hidden_score() -> None:
    assert normalize_hidden_score(71.0, 100.0) == 0.71
    assert normalize_hidden_score(150.0, 100.0) == 1.0
    assert normalize_hidden_score(-1.0, 100.0) == 0.0


def test_recommendation_score_weighted_sum() -> None:
    score = recommendation_score(0.8, 50.0, config=_config())
    assert score == 0.6 * 0.8 + 0.4 * 0.5
