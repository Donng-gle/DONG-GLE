"""log_emotion_tag 테이블에 방문 기록 감성 분석 결과를 저장한다."""

from __future__ import annotations

from collections.abc import Sequence

from semantic_vector.constants import MAJOR_TAG_ORDER
from semantic_vector.models import PlaceImageInput, SemanticVectorResult

UPSERT_LOG_EMOTION_TAG_SQL = """
INSERT INTO log_emotion_tag (visit_log_id, tag, score)
VALUES (%(visit_log_id)s, %(tag)s, %(score)s)
ON CONFLICT (visit_log_id, tag) DO UPDATE SET
    score = EXCLUDED.score;
"""


def build_log_emotion_tag_rows(
  result: SemanticVectorResult,
  input_data: PlaceImageInput,
) -> list[dict[str, object]]:
  """7개 대분류 태그 점수를 log_emotion_tag row(태그당 1행)로 변환한다.

  threshold로 거르지 않고 원본 점수 그대로 저장한다 — 백엔드가 조회 시점에
  SUM(score)로 태그를 집계하므로(LogEmotionTagRepository.countTagsByPlaceId),
  여기서 미리 걸러내면 오히려 신호가 줄어든다.
  """
  major_scores = result.major_scores.model_dump()
  visit_log_id = int(input_data.place_id)
  return [
    {"visit_log_id": visit_log_id, "tag": tag, "score": major_scores[tag]}
    for tag in MAJOR_TAG_ORDER
  ]


def save_log_emotion_tags(
  cur,
  results: Sequence[SemanticVectorResult],
  inputs: Sequence[PlaceImageInput],
) -> int:
  """분석 성공 결과를 log_emotion_tag에 저장한다. 반환값: 저장된 visit_log 수."""
  input_by_visit_log_id = {item.place_id: item for item in inputs}
  saved_count = 0

  for result in results:
    input_data = input_by_visit_log_id.get(result.place_id)
    if input_data is None:
      continue
    for row in build_log_emotion_tag_rows(result, input_data):
      cur.execute(UPSERT_LOG_EMOTION_TAG_SQL, row)
    saved_count += 1

  return saved_count


def is_visit_log_emotion_analyzed(cur, visit_log_id: int) -> bool:
  """해당 visit_log가 이미 감성 분석되었는지 확인한다 (버전 추적 없이 존재 여부만)."""
  cur.execute(
    "SELECT 1 FROM log_emotion_tag WHERE visit_log_id = %s LIMIT 1",
    (visit_log_id,),
  )
  return cur.fetchone() is not None


def count_log_emotion_status(cur) -> dict[str, int]:
  """전체 visit_log 기준 감성 분석 완료/미완료/사진없음 수를 집계한다."""
  cur.execute(
    """
    SELECT
        COUNT(*) FILTER (WHERE has_photo AND analyzed) AS analyzed_count,
        COUNT(*) FILTER (WHERE has_photo AND NOT analyzed) AS pending_count,
        COUNT(*) FILTER (WHERE NOT has_photo) AS no_photo_count
    FROM (
        SELECT
            vl.id,
            EXISTS (
              SELECT 1 FROM visit_log_photo vlp WHERE vlp.visit_log_id = vl.id
            ) AS has_photo,
            EXISTS (
              SELECT 1 FROM log_emotion_tag let WHERE let.visit_log_id = vl.id
            ) AS analyzed
        FROM visit_log vl
    ) sub
    """
  )
  analyzed_count, pending_count, no_photo_count = cur.fetchone()
  return {
    "analyzed_count": analyzed_count,
    "pending_count": pending_count,
    "no_photo_count": no_photo_count,
  }
