"""모델 가격과 token 기반 비용 계산.

가격은 이 파일에서만 관리한다. USD / 1M tokens 기준.
GPT-4.1 mini: https://openai.com/index/gpt-4-1/ (Input $0.40, Cached $0.10, Output $1.60)
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from semantic_vector.models import VisionCallUsage

USD_PER_MILLION_TOKENS: dict[str, dict[str, float]] = {
  "gpt-4.1-mini": {
    "input": 0.40,
    "cached_input": 0.10,
    "output": 1.60,
  },
}

DEFAULT_PRICING_MODEL = "gpt-4.1-mini"


def get_model_rates(model_name: str) -> dict[str, float]:
  """모델별 USD/1M token 요율을 반환한다."""
  rates = USD_PER_MILLION_TOKENS.get(model_name)
  if rates is None:
    raise ValueError(
      f"Unknown model pricing: {model_name!r}. "
      f"Add rates to USD_PER_MILLION_TOKENS in semantic_vector/pricing.py."
    )
  return rates


def calculate_call_cost_usd(
  usage: VisionCallUsage,
  *,
  model_name: str = DEFAULT_PRICING_MODEL,
) -> float | None:
  """실제 API usage로 한 번 호출 비용을 계산한다. token이 없으면 None."""
  if usage.input_tokens is None or usage.output_tokens is None:
    return None

  rates = get_model_rates(model_name)
  cached = usage.cached_input_tokens or 0
  billed_input = max(usage.input_tokens - cached, 0)
  return (
    billed_input * rates["input"]
    + cached * rates["cached_input"]
    + usage.output_tokens * rates["output"]
  ) / 1_000_000


def _mean(values: Sequence[float]) -> float | None:
  if not values:
    return None
  return sum(values) / len(values)


@dataclass(frozen=True)
class EfficiencySummary:
  call_count: int
  success_count: int
  failure_count: int
  average_input_tokens: float | None
  average_output_tokens: float | None
  average_total_tokens: float | None
  average_tokens_per_place: float | None
  average_latency_ms: float | None
  average_cost_per_call: float | None
  average_cost_per_image: float | None
  average_cost_per_place: float | None
  estimated_full_backfill_cost: float | None
  total_cost: float | None
  total_tokens: int | None


def summarize_efficiency(
  usages: Sequence[VisionCallUsage],
  *,
  model_name: str = DEFAULT_PRICING_MODEL,
  place_count: int,
  images_per_place: int = 3,
  full_db_place_count: int | None = None,
) -> EfficiencySummary:
  """VLM 호출 usage 목록으로 평균 token/cost/latency를 집계한다."""
  successful = [item for item in usages if item.success]
  costs = [
    cost
    for item in successful
    if (cost := calculate_call_cost_usd(item, model_name=model_name)) is not None
  ]
  input_tokens = [item.input_tokens for item in successful if item.input_tokens is not None]
  output_tokens = [item.output_tokens for item in successful if item.output_tokens is not None]
  total_tokens = [item.total_tokens for item in successful if item.total_tokens is not None]
  latencies = [item.latency_ms for item in successful if item.latency_ms is not None]

  average_cost_per_call = _mean(costs)
  average_cost_per_image = average_cost_per_call
  average_cost_per_place = (
    average_cost_per_call * images_per_place
    if average_cost_per_call is not None
    else None
  )
  estimated_full_backfill_cost = (
    average_cost_per_place * full_db_place_count
    if average_cost_per_place is not None and full_db_place_count is not None
    else None
  )
  average_total_tokens = _mean(total_tokens)
  return EfficiencySummary(
    call_count=len(usages),
    success_count=len(successful),
    failure_count=len(usages) - len(successful),
    average_input_tokens=_mean(input_tokens),
    average_output_tokens=_mean(output_tokens),
    average_total_tokens=average_total_tokens,
    average_tokens_per_place=(
      average_total_tokens * images_per_place
      if average_total_tokens is not None
      else None
    ),
    average_latency_ms=_mean(latencies),
    average_cost_per_call=average_cost_per_call,
    average_cost_per_image=average_cost_per_image,
    average_cost_per_place=average_cost_per_place,
    estimated_full_backfill_cost=estimated_full_backfill_cost,
    total_cost=sum(costs) if costs else None,
    total_tokens=sum(total_tokens) if total_tokens else None,
  )
