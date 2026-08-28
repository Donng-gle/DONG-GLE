"""환경변수 및 설정값 관리."""

from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from semantic_vector.constants import DEFAULT_COLLECTION_NAME

_AI_ROOT = Path(__file__).resolve().parents[1]
_ENV_FILE = _AI_ROOT / ".env"


class SemanticVectorConfig(BaseSettings):
    """Semantic vector 파이프라인 설정."""

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    openai_api_key: str = Field(validation_alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4.1-mini", validation_alias="OPENAI_MODEL")

    qdrant_url: str = Field(validation_alias="QDRANT_URL")
    qdrant_api_key: str | None = Field(default=None, validation_alias="QDRANT_API_KEY")
    qdrant_collection_name: str = Field(
        default=DEFAULT_COLLECTION_NAME,
        validation_alias="QDRANT_COLLECTION_NAME",
    )

    prompt_version: str = Field(
        default="semantic-image-v4.1",
        validation_alias="SEMANTIC_PROMPT_VERSION",
    )
    tag_schema_version: str = Field(
        default="tourism-semantic-tags-v1",
        validation_alias="SEMANTIC_TAG_SCHEMA_VERSION",
    )

    max_retry_count: int = Field(default=3, validation_alias="SEMANTIC_MAX_RETRY_COUNT")
    batch_concurrency: int = Field(default=3, validation_alias="SEMANTIC_BATCH_CONCURRENCY")
    images_per_place: int = Field(
        default=3,
        validation_alias="SEMANTIC_IMAGES_PER_PLACE",
    )
    trace_experiment: str | None = Field(
        default=None,
        validation_alias="SEMANTIC_TRACE_EXPERIMENT",
    )
    trace_run_type: str = Field(
        default="production",
        validation_alias="SEMANTIC_TRACE_RUN_TYPE",
    )
