from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from place_recommender.config import PlaceRecommenderConfig
from place_recommender.hidden_score_lookup import StaticHiddenScoreLookup
from place_recommender.models import RecommendRequest
from place_recommender.recommender import recommend_places
from semantic_vector.config import SemanticVectorConfig


def _config() -> PlaceRecommenderConfig:
    return PlaceRecommenderConfig(qdrant_url="http://localhost:6333")


def _semantic_config() -> SemanticVectorConfig:
    return SemanticVectorConfig(
        openai_api_key="test",
        qdrant_url="http://localhost:6333",
    )


def _hit(place_id: str, score: float) -> SimpleNamespace:
    return SimpleNamespace(place_id=place_id, score=score, payload={})


@pytest.mark.asyncio
async def test_recommend_combines_similarity_and_hidden_score() -> None:
    request = RecommendRequest(relaxing=0.8, lively=0.2, top_n=2)
    hits = [_hit("10", 0.9), _hit("20", 0.7), _hit("30", 0.8)]
    lookup = StaticHiddenScoreLookup({"10": 10.0, "20": 90.0, "30": 40.0})

    with patch(
        "place_recommender.recommender.search_similar_places_by_major_vector",
        new=AsyncMock(return_value=hits),
    ) as search_mock:
        result = await recommend_places(
            request,
            config=_config(),
            semantic_config=_semantic_config(),
            hidden_lookup=lookup,
        )

    assert [item.place_id for item in result.recommendations] == ["20", "30"]
    search_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_min_similarity_filters_hits() -> None:
    request = RecommendRequest(relaxing=0.8, min_similarity=0.75, top_n=10)
    hits = [_hit("1", 0.9), _hit("2", 0.5)]

    with patch(
        "place_recommender.recommender.search_similar_places_by_major_vector",
        new=AsyncMock(return_value=hits),
    ):
        result = await recommend_places(
            request,
            config=_config(),
            semantic_config=_semantic_config(),
            hidden_lookup=StaticHiddenScoreLookup(),
        )

    assert [item.place_id for item in result.recommendations] == ["1"]
