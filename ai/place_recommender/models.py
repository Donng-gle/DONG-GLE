"""장소 추천 요청/응답 모델.

server-back의 사용자 취향 형식:
- UserVectorResponse: 7개 태그 필드
- UserPreferencesResponse: { preferences: [{ tag, score }] }
둘 다 받는다.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

from semantic_vector.constants import MAJOR_TAG_ORDER
from semantic_vector.models import MajorScores


class PreferenceTag(BaseModel):
    tag: str
    score: float = Field(ge=0.0, le=1.0)


class RecommendRequest(BaseModel):
    """사용자 취향 기반 장소 추천 요청."""

    relaxing: float | None = Field(default=None, ge=0.0, le=1.0)
    lively: float | None = Field(default=None, ge=0.0, le=1.0)
    romantic: float | None = Field(default=None, ge=0.0, le=1.0)
    local: float | None = Field(default=None, ge=0.0, le=1.0)
    photogenic: float | None = Field(default=None, ge=0.0, le=1.0)
    traditional: float | None = Field(default=None, ge=0.0, le=1.0)
    modern: float | None = Field(default=None, ge=0.0, le=1.0)
    preferences: list[PreferenceTag] | None = None

    top_n: int = Field(default=20, ge=1, le=100)
    min_similarity: float = Field(default=0.0, ge=0.0, le=1.0)
    exclude_place_ids: list[str] = Field(default_factory=list)
    category: str | None = None

    def to_major_scores(self) -> MajorScores:
        values = {tag: 0.5 for tag in MAJOR_TAG_ORDER}
        if self.preferences:
            for item in self.preferences:
                if item.tag in values:
                    values[item.tag] = item.score
        for tag in MAJOR_TAG_ORDER:
            field_value = getattr(self, tag)
            if field_value is not None:
                values[tag] = field_value
        return MajorScores(**values)

    @model_validator(mode="after")
    def require_preference_values(self) -> RecommendRequest:
        has_flat = any(getattr(self, tag) is not None for tag in MAJOR_TAG_ORDER)
        has_list = bool(self.preferences)
        if not has_flat and not has_list:
            raise ValueError("user preference tags are required")
        return self


class RecommendationItem(BaseModel):
    place_id: str
    similarity_score: float
    hidden_score: float
    recommendation_score: float


class RecommendResponse(BaseModel):
    recommendations: list[RecommendationItem]
