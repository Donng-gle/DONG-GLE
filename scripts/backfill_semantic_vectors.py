"""기존 DB place를 Semantic Vector로 Backfill한다."""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "data"))
sys.path.insert(0, str(ROOT / "ai"))

from pipeline.semantic_vector_sync import (  # noqa: E402
  analyze_saved_places,
  build_semantic_inputs,
  load_places_for_semantic_backfill,
  log_semantic_analysis_result,
)
from semantic_vector.config import SemanticVectorConfig  # noqa: E402


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(description="Backfill semantic vectors to Qdrant")
  parser.add_argument("--batch-size", type=int, default=50)
  parser.add_argument("--limit", type=int, default=None)
  parser.add_argument("--place-id", type=str, default=None)
  parser.add_argument("--concurrency", type=int, default=None)
  return parser.parse_args()


async def backfill_semantic_vectors(
  *,
  batch_size: int = 50,
  limit: int | None = None,
  place_id: str | None = None,
  concurrency: int | None = None,
  config: SemanticVectorConfig | None = None,
) -> None:
  places = load_places_for_semantic_backfill(limit=limit, place_id=place_id)
  valid_inputs = build_semantic_inputs(places)

  if not valid_inputs:
    print("semantic_vector backfill: 분석 대상 없음")
    return

  resolved_config = config or SemanticVectorConfig()
  total_success = 0
  total_failed = 0

  for start in range(0, len(valid_inputs), batch_size):
    batch_inputs = valid_inputs[start : start + batch_size]
    batch_place_ids = {item.place_id for item in batch_inputs}
    batch_places = [place for place in places if str(place["id"]) in batch_place_ids]

    result = await analyze_saved_places(
      batch_places,
      config=resolved_config,
      concurrency=concurrency,
    )
    log_semantic_analysis_result(result, batch_inputs, config=resolved_config)

    total_success += result.success_count
    total_failed += result.failed_count
    print(
      f"batch={start // batch_size + 1} "
      f"success={result.success_count} "
      f"failed={result.failed_count}"
    )

  print(
    f"semantic_vector backfill complete: "
    f"targets={len(valid_inputs)} success={total_success} failed={total_failed}"
  )


def main() -> None:
  logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
  args = parse_args()
  asyncio.run(
    backfill_semantic_vectors(
      batch_size=args.batch_size,
      limit=args.limit,
      place_id=args.place_id,
      concurrency=args.concurrency,
    )
  )


if __name__ == "__main__":
  main()
