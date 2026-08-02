"""Backfill script 테스트."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from scripts.backfill_semantic_vectors import backfill_semantic_vectors  # noqa: E402
from semantic_vector.models import BatchAnalysisResult  # noqa: E402


@pytest.mark.asyncio
async def test_backfill_semantic_vectors_batches_inputs() -> None:
  places = [
    {"id": index, "main_image_url": f"https://example.com/{index}.jpg", "category": "관광지"}
    for index in range(1, 4)
  ]

  with (
    patch(
      "scripts.backfill_semantic_vectors.load_places_for_semantic_backfill",
      return_value=places,
    ),
    patch(
      "scripts.backfill_semantic_vectors.analyze_saved_places",
      new=AsyncMock(
        side_effect=[
          BatchAnalysisResult(
            total_count=2, success_count=2, failed_count=0, results=[], failures=[]
          ),
          BatchAnalysisResult(
            total_count=1, success_count=1, failed_count=0, results=[], failures=[]
          ),
        ]
      ),
    ) as analyze_mock,
    patch("scripts.backfill_semantic_vectors.log_semantic_analysis_result"),
  ):
    await backfill_semantic_vectors(batch_size=2, limit=3)

  assert analyze_mock.await_count == 2
