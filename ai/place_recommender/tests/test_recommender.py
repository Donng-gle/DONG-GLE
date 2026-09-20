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


def _hit(
    place_id: str,
    score: float,
    *,
    image_id: str | None = None,
    image_url: str | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        place_id=place_id,
        score=score,
        payload={},
        image_id=image_id or f"{place_id}-img1",
        image_url=image_url or f"https://example.com/{place_id}.jpg",
    )


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
    assert result.course_recommendations == []
    assert result.recommendations[0].image_id == "20-img1"
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


@pytest.mark.asyncio
async def test_course_keeps_best_image_per_place_and_excludes_from_place_list() -> None:
    request = RecommendRequest(relaxing=0.9, top_n=5, course_top_n=2)
    # place 1 has three images; best is img1 (highest score)
    hits = [
        _hit("1", 0.95, image_id="1-img1", image_url="https://1-a.jpg"),
        _hit("1", 0.90, image_id="1-img2", image_url="https://1-b.jpg"),
        _hit("1", 0.85, image_id="1-img3", image_url="https://1-c.jpg"),
        _hit("2", 0.80, image_id="2-img1", image_url="https://2-a.jpg"),
        _hit("2", 0.70, image_id="2-img2", image_url="https://2-b.jpg"),
        _hit("3", 0.60, image_id="3-img1", image_url="https://3-a.jpg"),
    ]

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

    assert [item.place_id for item in result.course_recommendations] == ["1", "2"]
    assert [item.image_id for item in result.course_recommendations] == ["1-img1", "2-img1"]
    # place 1,2 이미지는 장소 추천에서 전부 제외 → place 3만
    assert [item.place_id for item in result.recommendations] == ["3"]
    assert result.recommendations[0].image_id == "3-img1"


@pytest.mark.asyncio
async def test_place_list_dedupes_to_best_image_per_place() -> None:
    request = RecommendRequest(relaxing=0.9, top_n=10, course_top_n=0)
    hits = [
        _hit("1", 0.9, image_id="1-img1"),
        _hit("1", 0.8, image_id="1-img2"),
        _hit("2", 0.7, image_id="2-img1"),
    ]

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

    assert [item.image_id for item in result.recommendations] == ["1-img1", "2-img1"]
    assert result.course_recommendations == []
