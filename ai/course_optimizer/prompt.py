"""LLM 1회 호출용 프롬프트."""

from __future__ import annotations

import json
from collections.abc import Sequence

from course_optimizer.models import CandidatePlace

COURSE_EVALUATION_SYSTEM_PROMPT = """당신은 여행 코스의 장소별 시간대 적합도, 장소 간 전이 적합도,
장소별 활동·휴식 특성을 판단하는 분석 모델이다.

각 장소는 7차원 majorScores 벡터
(relaxing, lively, romantic, local, photogenic, traditional, modern)
와 category로 주어진다.

## 시간대 적합도
각 장소가 morning/lunch/afternoon/evening/night 다섯 시간대에
얼마나 적합한지 0.0~1.0으로 판단하라.

## 전이 적합도
두 장소 사이 방문 순서 A→B가 얼마나 자연스러운지 0.0~1.0으로 판단하라.
다음 기준을 반드시 따른다.

- lively가 높은 장소 다음에 relaxing이 높은 장소로 이어지면
  자연스러운 전환으로 간주해 0.85~0.90 수준의 높은 점수를 준다.
- 동일한 category가 연속되면 반복으로 간주해 0.40~0.55 수준의 점수를 준다.
- traditional과 modern처럼 정반대 성격이 급격히 뒤바뀌면
  분위기 단절로 간주해 0.20~0.30 수준의 낮은 점수를 준다.
- 위에 해당하지 않으면 두 벡터의 전반적 유사도로 0.75~0.85 수준의
  중간~높은 점수를 준다.

## 활동·휴식 특성
각 장소의 activityLevel, restLevel을 0.0~1.0으로 판단하라.
majorScores에서 기계적으로 파생시키지 말고, 벡터가 나타내는
활동성/휴식성을 직접 판단한다.

지정된 JSON Schema에 맞는 JSON만 반환한다."""


def build_candidate_places_json(candidates: Sequence[CandidatePlace]) -> str:
  """후보 장소 목록을 LLM 입력 JSON으로 직렬화한다."""
  payload = [
    {
      "place_id": candidate.place_id,
      "category": candidate.category,
      "major_scores": candidate.major_scores.model_dump(),
    }
    for candidate in candidates
  ]
  return json.dumps(payload, ensure_ascii=False, indent=2)


def build_user_prompt(candidates: Sequence[CandidatePlace]) -> str:
  """LLM user prompt를 생성한다."""
  return (
    "다음은 방문 후보 장소 목록이다.\n\n"
    f"{build_candidate_places_json(candidates)}\n\n"
    "위 장소들에 대해 시간대 적합도, 모든 장소 쌍의 전이 적합도(양방향), "
    "활동·휴식 특성을 생성하라."
  )


def _time_suitability_schema() -> dict:
  return {
    "type": "object",
    "additionalProperties": False,
    "required": ["morning", "lunch", "afternoon", "evening", "night"],
    "properties": {
      "morning": {"type": "number"},
      "lunch": {"type": "number"},
      "afternoon": {"type": "number"},
      "evening": {"type": "number"},
      "night": {"type": "number"},
    },
  }


def _place_features_schema() -> dict:
  return {
    "type": "object",
    "additionalProperties": False,
    "required": ["activity_level", "rest_level"],
    "properties": {
      "activity_level": {"type": "number"},
      "rest_level": {"type": "number"},
    },
  }


def build_evaluation_json_schema(candidates: Sequence[CandidatePlace]) -> dict:
  """Structured Output용 JSON Schema를 반환한다.

  OpenAI strict json_schema는 동적 additionalProperties를 허용하지 않으므로
  후보 place_id를 properties/required에 명시한다.
  """
  place_ids = [candidate.place_id for candidate in candidates]

  time_properties = {
    place_id: _time_suitability_schema() for place_id in place_ids
  }
  feature_properties = {
    place_id: _place_features_schema() for place_id in place_ids
  }
  transition_properties = {}
  for from_id in place_ids:
    to_properties = {
      to_id: {"type": "number"}
      for to_id in place_ids
      if to_id != from_id
    }
    transition_properties[from_id] = {
      "type": "object",
      "additionalProperties": False,
      "required": list(to_properties.keys()),
      "properties": to_properties,
    }

  return {
    "type": "object",
    "additionalProperties": False,
    "required": ["time_suitability", "transition_scores", "place_features"],
    "properties": {
      "time_suitability": {
        "type": "object",
        "additionalProperties": False,
        "required": place_ids,
        "properties": time_properties,
      },
      "transition_scores": {
        "type": "object",
        "additionalProperties": False,
        "required": place_ids,
        "properties": transition_properties,
      },
      "place_features": {
        "type": "object",
        "additionalProperties": False,
        "required": place_ids,
        "properties": feature_properties,
      },
    },
  }
