"""pricing 테스트."""

from __future__ import annotations

import pytest

from semantic_vector.models import VisionCallUsage
from semantic_vector.pricing import calculate_call_cost_usd, summarize_efficiency


def test_calculate_call_cost_uses_central_rates() -> None:
  usage = VisionCallUsage(input_tokens=1_000_000, output_tokens=1_000_000, total_tokens=2_000_000)
  assert calculate_call_cost_usd(usage) == pytest.approx(2.0)


def test_calculate_call_cost_applies_cached_input_rate() -> None:
  usage = VisionCallUsage(
    input_tokens=1_000_000,
    output_tokens=0,
    total_tokens=1_000_000,
    cached_input_tokens=1_000_000,
  )
  assert calculate_call_cost_usd(usage) == pytest.approx(0.10)


def test_summarize_efficiency_scales_cost_per_place() -> None:
  usages = [
    VisionCallUsage(
      input_tokens=1000,
      output_tokens=500,
      total_tokens=1500,
      latency_ms=1200,
      success=True,
    )
    for _ in range(3)
  ]
  summary = summarize_efficiency(
    usages,
    place_count=1,
    images_per_place=3,
    full_db_place_count=100,
  )

  assert summary.success_count == 3
  assert summary.average_cost_per_place == pytest.approx(summary.average_cost_per_call * 3)
  assert summary.estimated_full_backfill_cost == pytest.approx(summary.average_cost_per_place * 100)
  assert summary.average_tokens_per_place == pytest.approx(4500)
