"""단일 장소 분석 흐름 조정."""

from __future__ import annotations

from dataclasses import dataclass

from semantic_vector.config import SemanticVectorConfig
from semantic_vector.models import PlaceImageInput, SemanticVectorResult, VisionAnalysisResponse
from semantic_vector.point_id import build_point_id
from semantic_vector.qdrant_repository import ensure_collection_exists, upsert_semantic_vector
from semantic_vector.score_calculator import aggregate_detail_scores, calculate_major_scores
from semantic_vector.tracing import build_trace_metadata, build_trace_tags, trace_span
from semantic_vector.vector_builder import build_detail_vector, build_major_vector
from semantic_vector.validators import validate_vector_dimensions
from semantic_vector.vision_client import analyze_image_with_vision


@dataclass(frozen=True)
class PlaceAnalysisResult:
  """장소 분석 결과와 이미지별 VLM 응답."""

  result: SemanticVectorResult
  per_image_responses: list[VisionAnalysisResponse]


async def _analyze_images_for_place(
  input_data: PlaceImageInput,
  *,
  config: SemanticVectorConfig,
) -> list[VisionAnalysisResponse]:
  """장소의 분석 대상 이미지를 각각 VLM으로 분석한다."""
  responses: list[VisionAnalysisResponse] = []
  image_urls = input_data.resolved_analysis_image_urls()

  for index, image_url in enumerate(image_urls):
    per_image_input = input_data.model_copy(
      update={
        "image_url": image_url,
        "image_id": input_data.image_id or f"{input_data.place_id}-img{index + 1}",
      }
    )
    response = await analyze_image_with_vision(
      per_image_input,
      config=config,
      image_index=index + 1,
    )
    responses.append(response)

  return responses


def _build_semantic_vector_result(
  input_data: PlaceImageInput,
  *,
  responses: list[VisionAnalysisResponse],
  config: SemanticVectorConfig,
) -> SemanticVectorResult:
  """이미지별 분석 결과를 집계해 장소 단위 SemanticVectorResult를 만든다."""
  aggregated_detail = aggregate_detail_scores(
    [response.detail_scores for response in responses]
  )
  major_scores = calculate_major_scores(aggregated_detail)
  detail_vector = build_detail_vector(aggregated_detail)
  major_vector = build_major_vector(major_scores)
  validate_vector_dimensions(detail_vector, major_vector)

  summaries = [response.summary for response in responses if response.summary]
  combined_summary = " | ".join(summaries) if summaries else None

  return SemanticVectorResult(
    place_id=input_data.place_id,
    image_id=input_data.image_id,
    detail_scores=aggregated_detail,
    major_scores=major_scores,
    detail_vector=detail_vector,
    major_vector=major_vector,
    summary=combined_summary,
    model_name=config.openai_model,
    prompt_version=config.prompt_version,
    tag_schema_version=config.tag_schema_version,
    qdrant_point_id=build_point_id(input_data.place_id),
  )


async def analyze_place_with_details(
  input_data: PlaceImageInput,
  *,
  config: SemanticVectorConfig | None = None,
  skip_collection_check: bool = False,
  persist: bool = True,
) -> PlaceAnalysisResult:
  """장소 이미지를 분석하고 이미지별 응답과 집계 결과를 함께 반환한다."""
  resolved_config = config or SemanticVectorConfig()
  metadata = build_trace_metadata(input_data, config=resolved_config)
  tags = build_trace_tags(resolved_config)

  async with trace_span(
    "place analysis",
    run_type="chain",
    metadata=metadata,
    tags=tags,
    inputs={
      "place_id": input_data.place_id,
      "place_name": input_data.name,
      "category": input_data.category,
      "image_count": len(input_data.resolved_analysis_image_urls()),
    },
  ) as place_run:
    responses = await _analyze_images_for_place(
      input_data,
      config=resolved_config,
    )
    async with trace_span(
      "aggregation",
      run_type="chain",
      metadata=metadata,
      tags=tags,
      inputs={"image_count": len(responses)},
    ) as aggregation_run:
      result = _build_semantic_vector_result(
        input_data,
        responses=responses,
        config=resolved_config,
      )
      if aggregation_run is not None:
        aggregation_run.end(
          outputs={
            "detail_scores": result.detail_scores.model_dump(),
            "major_scores": result.major_scores.model_dump(),
          }
        )

    if persist:
      if not skip_collection_check:
        await ensure_collection_exists(resolved_config)
      await upsert_semantic_vector(
        result,
        input_data,
        config=resolved_config,
      )

    if place_run is not None:
      place_run.end(
        outputs={
          "place_id": result.place_id,
          "major_scores": result.major_scores.model_dump(),
          "summary": result.summary,
        }
      )

  return PlaceAnalysisResult(result=result, per_image_responses=responses)


async def analyze_place(
  input_data: PlaceImageInput,
  *,
  config: SemanticVectorConfig | None = None,
  skip_collection_check: bool = False,
) -> SemanticVectorResult:
  """장소 이미지를 분석하고 Qdrant에 저장한다.

  image_url은 대표사진이며, analysis_image_urls에 지정된 여러 장을 분석한 뒤
  태그를 집계해 대표사진 기준으로 저장한다.
  """
  place_analysis = await analyze_place_with_details(
    input_data,
    config=config,
    skip_collection_check=skip_collection_check,
  )
  return place_analysis.result
