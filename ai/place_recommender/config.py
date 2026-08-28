"""장소 추천 가중치 및 조회 설정."""

from __future__ import annotations

import math
from pathlib import Path
from typing import Self

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_AI_ROOT = Path(__file__).resolve().parents[1]
_ENV_FILE = _AI_ROOT / ".env"


class PlaceRecommenderConfig(BaseSettings):
    """Qdrant 검색 + Hidden Score 결합 설정."""

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    qdrant_url: str = Field(validation_alias="QDRANT_URL")
    qdrant_api_key: str | None = Field(default=None, validation_alias="QDRANT_API_KEY")
    qdrant_collection_name: str = Field(
        default="place_semantic_vectors",
        validation_alias="QDRANT_COLLECTION_NAME",
    )
    database_url: str | None = Field(default=None, validation_alias="DATABASE_URL")

    similarity_weight: float = Field(default=0.6, ge=0.0, le=1.0)
    hidden_score_weight: float = Field(default=0.4, ge=0.0, le=1.0)
    hidden_score_scale: float = Field(default=100.0, gt=0.0)
    candidate_limit: int = Field(default=50, ge=1)

    @model_validator(mode="after")
    def validate_weights(self) -> Self:
        total = self.similarity_weight + self.hidden_score_weight
        if not math.isclose(total, 1.0, rel_tol=0.0, abs_tol=1e-9):
            raise ValueError(
                "similarity_weight + hidden_score_weight must equal 1.0, "
                f"got {self.similarity_weight} + {self.hidden_score_weight} = {total}"
            )
        return self
