"""Hidden Score 입력·설정·결과 데이터 모델."""

from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

from hidden_score.config import (
    DEFAULT_BAYESIAN_WORTHINESS_WEIGHT,
    DEFAULT_GOOGLE_HIDDENNESS_WEIGHT,
    DEFAULT_GPT_WORTHINESS_WEIGHT,
    DEFAULT_MINIMUM_REVIEW_COUNT,
    DEFAULT_SCORE_SCALE,
    DEFAULT_TOURISM_HIDDENNESS_WEIGHT,
)
from hidden_score.validators import validate_weight_sum


class TourismStatisticsInput(BaseModel):
    """관광 순위 통계 원본."""

    appearance_count: int = Field(ge=0)
    average_rank: float | None = None
    total_months: int = Field(default=12, gt=0)
    ranking_size: int = Field(default=100, gt=1)

    @model_validator(mode="after")
    def validate_appearance_and_rank(self) -> TourismStatisticsInput:
        if self.appearance_count > self.total_months:
            raise ValueError("appearance_count cannot exceed total_months")
        if self.appearance_count == 0:
            if self.average_rank is not None:
                raise ValueError("average_rank must be None when appearance_count is 0")
            return self
        if self.average_rank is None:
            raise ValueError("average_rank is required when appearance_count > 0")
        if not 1 <= self.average_rank <= self.ranking_size:
            raise ValueError("average_rank must be between 1 and ranking_size")
        return self


class PlaceScoreInput(BaseModel):
    """장소별 Hidden Score 계산 입력."""

    place_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    rating: float = Field(ge=1.0, le=5.0)
    review_count: int = Field(ge=0)

    review_percentile: float | None = Field(default=None, ge=0.0, le=1.0)
    tourism_statistics: TourismStatisticsInput | None = None
    tps: float | None = Field(default=None, ge=0.0, le=1.0)

    gpt_worthiness: float = Field(ge=0.0, le=1.0)


class HiddenScoreConfig(BaseModel):
    """Hidden Score 계산 설정."""

    google_hiddenness_weight: float = Field(
        default=DEFAULT_GOOGLE_HIDDENNESS_WEIGHT, ge=0.0, le=1.0
    )
    tourism_hiddenness_weight: float = Field(
        default=DEFAULT_TOURISM_HIDDENNESS_WEIGHT, ge=0.0, le=1.0
    )

    bayesian_worthiness_weight: float = Field(
        default=DEFAULT_BAYESIAN_WORTHINESS_WEIGHT, ge=0.0, le=1.0
    )
    gpt_worthiness_weight: float = Field(
        default=DEFAULT_GPT_WORTHINESS_WEIGHT, ge=0.0, le=1.0
    )

    minimum_review_count: float = Field(default=DEFAULT_MINIMUM_REVIEW_COUNT, gt=0.0)
    dataset_mean_rating: float | None = Field(default=None, ge=1.0, le=5.0)

    score_scale: float = Field(default=DEFAULT_SCORE_SCALE, gt=0.0)

    @model_validator(mode="after")
    def validate_weights(self) -> HiddenScoreConfig:
        validate_weight_sum(
            self.google_hiddenness_weight,
            self.tourism_hiddenness_weight,
        )
        validate_weight_sum(
            self.bayesian_worthiness_weight,
            self.gpt_worthiness_weight,
        )
        return self


class HiddenScoreResult(BaseModel):
    """Hidden Score 계산 결과."""

    place_id: str
    name: str

    rating: float
    review_count: int
    review_percentile: float
    tps: float

    google_hiddenness: float
    tourism_hiddenness: float
    hiddenness: float

    bayesian_rating: float
    bayesian_worthiness: float
    gpt_worthiness: float
    worthiness: float

    hidden_score: float
