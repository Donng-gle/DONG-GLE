"""LangSmith tracing helper. LangChain 없이 기존 OpenAI 호출에 메타데이터만 붙인다."""

from __future__ import annotations

from collections.abc import AsyncIterator, Mapping
from contextlib import asynccontextmanager
from typing import Any

from semantic_vector.config import SemanticVectorConfig
from semantic_vector.models import PlaceImageInput

DEFAULT_PILOT_EXPERIMENT = "andong-production-pilot-v4.1"


def build_trace_metadata(
  input_data: PlaceImageInput,
  *,
  config: SemanticVectorConfig,
  image_index: int | None = None,
  extra: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
  """VLM 호출에 남길 LangSmith metadata를 만든다."""
  metadata: dict[str, Any] = {
    "model": config.openai_model,
    "prompt_version": config.prompt_version,
    "tag_schema_version": config.tag_schema_version,
    "place_id": input_data.place_id,
    "place_name": input_data.name,
    "experiment": config.trace_experiment,
    "run_type": config.trace_run_type,
  }
  if image_index is not None:
    metadata["image_index"] = image_index
  if extra:
    metadata.update(extra)
  return metadata


def build_trace_tags(config: SemanticVectorConfig) -> list[str]:
  """LangSmith 필터용 태그를 만든다."""
  tags = [config.prompt_version, config.openai_model, config.trace_run_type]
  if config.trace_experiment:
    tags.append(config.trace_experiment)
  return tags


@asynccontextmanager
async def trace_span(
  name: str,
  *,
  run_type: str = "chain",
  metadata: Mapping[str, Any] | None = None,
  inputs: Mapping[str, Any] | None = None,
  tags: list[str] | None = None,
) -> AsyncIterator[Any]:
  """LangSmith span을 연다. tracing이 꺼져 있거나 패키지가 없으면 no-op."""
  try:
    from langsmith import trace
  except ImportError:
    yield None
    return

  async with trace(
    name,
    run_type=run_type,  # type: ignore[arg-type]
    metadata=dict(metadata or {}),
    inputs=dict(inputs or {}),
    tags=tags,
  ) as run:
    yield run
