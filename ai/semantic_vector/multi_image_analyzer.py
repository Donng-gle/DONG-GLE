"""장소당 다중 이미지 VLM 분석 호환 레이어."""

from __future__ import annotations

from collections.abc import Sequence

from semantic_vector.analyzer import analyze_place_with_details
from semantic_vector.config import SemanticVectorConfig
from semantic_vector.constants import DEFAULT_IMAGES_PER_PLACE
from semantic_vector.input_mapper import select_analysis_image_urls
from semantic_vector.models import PlaceImageInput, SemanticVectorResult, VisionAnalysisResponse


async def analyze_place_images(
  place_id: str,
  image_urls: Sequence[str],
  *,
  category: str | None = None,
  name: str | None = None,
  region: str | None = None,
  config: SemanticVectorConfig | None = None,
  skip_collection_check: bool = False,
  persist: bool = True,
  images_per_place: int = DEFAULT_IMAGES_PER_PLACE,
) -> tuple[SemanticVectorResult, list[VisionAnalysisResponse]]:
  """장소 이미지를 분석한다. 첫 번째 URL을 대표사진으로 사용한다."""
  if not image_urls:
    raise ValueError("image_urls must not be empty")

  representative_image_url = str(image_urls[0])
  analysis_image_urls = select_analysis_image_urls(
    representative_image_url,
    image_urls[1:],
    images_per_place=images_per_place,
  )
  input_data = PlaceImageInput(
    place_id=place_id,
    image_url=representative_image_url,
    analysis_image_urls=analysis_image_urls,
    name=name,
    region=region,
    category=category,
  )

  place_analysis = await analyze_place_with_details(
    input_data,
    config=config,
    skip_collection_check=skip_collection_check,
    persist=persist,
  )
  return place_analysis.result, place_analysis.per_image_responses
