"""단일 장소 분석 흐름 조정."""

from __future__ import annotations

from semantic_vector.config import SemanticVectorConfig
from semantic_vector.models import PlaceImageInput, SemanticVectorResult
from semantic_vector.point_id import build_point_id
from semantic_vector.qdrant_repository import ensure_collection_exists, upsert_semantic_vector
from semantic_vector.score_calculator import calculate_major_scores
from semantic_vector.vector_builder import build_detail_vector, build_major_vector
from semantic_vector.validators import validate_vector_dimensions
from semantic_vector.vision_client import analyze_image_with_vision


async def analyze_place(
  input_data: PlaceImageInput,
  *,
  config: SemanticVectorConfig | None = None,
  skip_collection_check: bool = False,
) -> SemanticVectorResult:
  """단일 장소 이미지를 분석하고 Qdrant에 저장한다."""
  resolved_config = config or SemanticVectorConfig()

  response = await analyze_image_with_vision(
    input_data,
    config=resolved_config,
  )

  major_scores = calculate_major_scores(response.detail_scores)
  detail_vector = build_detail_vector(response.detail_scores)
  major_vector = build_major_vector(major_scores)

  validate_vector_dimensions(detail_vector, major_vector)

  result = SemanticVectorResult(
    place_id=input_data.place_id,
    image_id=input_data.image_id,
    detail_scores=response.detail_scores,
    major_scores=major_scores,
    detail_vector=detail_vector,
    major_vector=major_vector,
    summary=response.summary,
    model_name=resolved_config.openai_model,
    prompt_version=resolved_config.prompt_version,
    tag_schema_version=resolved_config.tag_schema_version,
    qdrant_point_id=build_point_id(input_data.place_id),
  )

  if not skip_collection_check:
    await ensure_collection_exists(resolved_config)

  await upsert_semantic_vector(
    result,
    input_data,
    config=resolved_config,
  )

  return result
