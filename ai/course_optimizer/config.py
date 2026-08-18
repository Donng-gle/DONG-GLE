"""환경변수 및 설정값 관리."""

from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_AI_ROOT = Path(__file__).resolve().parents[1]
_ENV_FILE = _AI_ROOT / ".env"


class CourseOptimizerConfig(BaseSettings):
  """여행 코스 최적화 설정."""

  model_config = SettingsConfigDict(
    env_file=str(_ENV_FILE),
    env_file_encoding="utf-8",
    extra="ignore",
    populate_by_name=True,
  )

  openai_api_key: str = Field(validation_alias="OPENAI_API_KEY")
  openai_model: str = Field(default="gpt-4.1-mini", validation_alias="OPENAI_MODEL")
  google_maps_api_key: str = Field(validation_alias="GOOGLE_MAPS_API_KEY")

  prompt_version: str = Field(
    default="course-evaluation-v1",
    validation_alias="COURSE_PROMPT_VERSION",
  )

  balance_penalty_k1: float = Field(default=5.0, validation_alias="COURSE_BALANCE_PENALTY_K1")
  balance_penalty_k2: float = Field(default=5.0, validation_alias="COURSE_BALANCE_PENALTY_K2")
  category_repeat_penalty: float = Field(
    default=5.0,
    validation_alias="COURSE_CATEGORY_REPEAT_PENALTY",
  )

  experience_weight: float = Field(default=0.5, validation_alias="COURSE_EXPERIENCE_WEIGHT")
  travel_weight: float = Field(default=0.5, validation_alias="COURSE_TRAVEL_WEIGHT")

  min_visit_count: int = Field(default=2, validation_alias="COURSE_MIN_VISIT_COUNT")
  max_retry_count: int = Field(default=3, validation_alias="COURSE_MAX_RETRY_COUNT")

  qdrant_url: str = Field(validation_alias="QDRANT_URL")
  qdrant_api_key: str | None = Field(default=None, validation_alias="QDRANT_API_KEY")
  qdrant_collection_name: str = Field(
    default="place_semantic_vectors",
    validation_alias="QDRANT_COLLECTION_NAME",
  )
