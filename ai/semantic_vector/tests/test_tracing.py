"""tracing metadata 테스트."""

from __future__ import annotations

from semantic_vector.config import SemanticVectorConfig
from semantic_vector.models import PlaceImageInput
from semantic_vector.tracing import build_trace_metadata, build_trace_tags


def test_build_trace_metadata_includes_required_fields() -> None:
  config = SemanticVectorConfig(
    openai_api_key="test",
    qdrant_url="http://localhost:6333",
    trace_experiment="andong-production-pilot-v4.1",
    trace_run_type="quality",
  )
  place = PlaceImageInput(
    place_id="123",
    image_url="https://example.com/1.jpg",
    name="월영교",
  )

  metadata = build_trace_metadata(place, config=config, image_index=2)

  assert metadata["model"] == "gpt-4.1-mini"
  assert metadata["prompt_version"] == "semantic-image-v4.1"
  assert metadata["tag_schema_version"] == "tourism-semantic-tags-v1"
  assert metadata["place_id"] == "123"
  assert metadata["place_name"] == "월영교"
  assert metadata["image_index"] == 2
  assert metadata["experiment"] == "andong-production-pilot-v4.1"
  assert metadata["run_type"] == "quality"
  assert "semantic-image-v4.1" in build_trace_tags(config)
