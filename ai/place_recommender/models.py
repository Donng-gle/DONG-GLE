"""장소/이미지 추천 요청/응답 모델.

server-back의 사용자 취향 형식:
- UserVectorResponse: 7개 태그 필드
- UserPreferencesResponse: { preferences: [{ tag, score }] }
둘 다 받는다.

검색 단위는 Qdrant 이미지 point이다. place_id당 best 이미지 선택과
코스/장소 추천 분리는 recommender에서 수행한다.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

from semantic_vector.constants import MAJOR_TAG_ORDER
from semantic_vector.models import MajorScores


class PreferenceTag(BaseModel):
    tag: str
    score: float = Field(ge=0.0, le=1.0)


class RecommendRequest(BaseModel):
    """사용자 취향 기반 이미지 단위 추천 요청."""

    relaxing: float | None = Field(default=None, ge=0.0, le=1.0)
    lively: float | None = Field(default=None, ge=0.0, le=1.0)
    romantic: float | None = Field(default=None, ge=0.0, le=1.0)
    local: float | None = Field(default=None, ge=0.0, le=1.0)
    photogenic: float | None = Field(default=None, ge=0.0, le=1.0)
    traditional: float | None = Field(default=None, ge=0.0, le=1.0)
    modern: float | None = Field(default=None, ge=0.0, le=1.0)
    preferences: list[PreferenceTag] | None = None

    top_n: int = Field(default=20, ge=1, le=100)
    course_top_n: int = Field(
        default=0,
        ge=0,
        le=100,
        description="코스용 place당 best 이미지 개수. 0이면 코스 목록을 비운다.",
    )
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
    image_id: str | None = None
    image_url: str | None = None
    similarity_score: float
    hidden_score: float
    recommendation_score: float


class RecommendResponse(BaseModel):
    """장소 추천 + (선택) 코스용 best 이미지 목록."""

    recommendations: list[RecommendationItem]
    course_recommendations: list[RecommendationItem] = Field(default_factory=list)
