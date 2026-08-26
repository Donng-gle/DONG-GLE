import pytest
from pydantic import ValidationError

from place_recommender.models import PreferenceTag, RecommendRequest


def test_flat_user_vector_request() -> None:
    request = RecommendRequest(relaxing=0.8, lively=0.2, traditional=0.9)
    scores = request.to_major_scores()
    assert scores.relaxing == 0.8
    assert scores.lively == 0.2
    assert scores.traditional == 0.9
    assert scores.romantic == 0.5


def test_preferences_list_from_server_back() -> None:
    request = RecommendRequest(
        preferences=[
            PreferenceTag(tag="relaxing", score=0.8),
            PreferenceTag(tag="local", score=0.9),
        ]
    )
    scores = request.to_major_scores()
    assert scores.relaxing == 0.8
    assert scores.local == 0.9
    assert scores.lively == 0.5


def test_flat_fields_override_preferences_list() -> None:
    request = RecommendRequest(
        relaxing=0.1,
        preferences=[PreferenceTag(tag="relaxing", score=0.9)],
    )
    assert request.to_major_scores().relaxing == 0.1


def test_empty_request_rejected() -> None:
    with pytest.raises(ValidationError):
        RecommendRequest()
