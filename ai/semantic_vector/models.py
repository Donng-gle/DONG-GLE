"""입력, GPT 응답, 결과 모델."""

from __future__ import annotations

from pydantic import BaseModel, Field, HttpUrl


class PlaceImageInput(BaseModel):
  """관광지 이미지 분석 입력."""

  place_id: str
  image_url: str

  image_id: str | None = None
  name: str | None = None
  region: str | None = None
  category: str | None = None


class DetailScores(BaseModel):
  """35개 세부 태그 점수."""

  quiet: float
  peaceful: float
  spacious: float
  nature_friendly: float
  stay_long: float

  crowded: float
  energetic: float
  colorful: float
  dynamic: float
  social: float

  warm_mood: float
  intimate: float
  date_friendly: float
  night_mood: float
  emotional: float

  local_identity: float
  daily_life: float
  authentic: float
  market_alley: float
  hidden_gem: float

  scenic: float
  composition: float
  landmark: float
  viewpoint: float
  photo_spot: float

  traditional_architecture: float
  historical: float
  cultural: float
  natural_material: float
  heritage_mood: float

  modern_architecture: float
  minimal: float
  urban: float
  trendy: float
  artistic: float


class MajorScores(BaseModel):
  """7개 대분류 점수."""

  relaxing: float
  lively: float
  romantic: float
  local: float
  photogenic: float
  traditional: float
  modern: float


class VisionAnalysisResponse(BaseModel):
  """GPT Vision 분석 응답."""

  detail_scores: DetailScores
  summary: str | None = None


class SemanticVectorResult(BaseModel):
  """단일 장소 분석 및 저장 결과."""

  place_id: str
  image_id: str | None

  detail_scores: DetailScores
  major_scores: MajorScores

  detail_vector: list[float]
  major_vector: list[float]

  summary: str | None

  model_name: str
  prompt_version: str
  tag_schema_version: str

  qdrant_point_id: str


class BatchAnalysisFailure(BaseModel):
  """Batch 처리 실패 항목."""

  place_id: str
  error_type: str
  error_message: str


class BatchAnalysisResult(BaseModel):
  """Batch 처리 결과."""

  total_count: int
  success_count: int
  failed_count: int

  results: list[SemanticVectorResult]
  failures: list[BatchAnalysisFailure]
