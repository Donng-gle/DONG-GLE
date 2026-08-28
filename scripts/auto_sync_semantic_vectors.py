"""DB에 새로 들어온 장소를 주기적으로 감지해 VLM → Qdrant까지 자동 반영한다.

사용 예:
  # 미분석 장소 1회 처리
  python scripts/auto_sync_semantic_vectors.py

  # 새 장소가 들어오면 자동 분석 (폴링)
  python scripts/auto_sync_semantic_vectors.py --watch --interval-seconds 60
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "data"))
sys.path.insert(0, str(ROOT / "ai"))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / "ai" / ".env")
load_dotenv(ROOT / "data" / ".env")

from pipeline.semantic_vector_sync import (  # noqa: E402
  get_semantic_analysis_status,
  sync_pending_semantic_vectors,
)
from semantic_vector.config import SemanticVectorConfig  # noqa: E402

logger = logging.getLogger(__name__)

def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(
    description="Pending semantic vectors를 DB에서 감지해 자동 분석/적재한다.",
  )
  parser.add_argument("--batch-size", type=int, default=20)
  parser.add_argument("--limit", type=int, default=None)
  parser.add_argument("--concurrency", type=int, default=None)
  parser.add_argument(
    "--watch",
    action="store_true",
    help="미분석 장소를 주기적으로 폴링하며 계속 동기화한다.",
  )
  parser.add_argument(
    "--interval-seconds",
    type=float,
    default=60.0,
    help="--watch 모드에서 대기 간격(초). 기본 60초.",
  )
  parser.add_argument(
    "--once",
    action="store_true",
    help="1회만 실행한다. (기본 동작과 동일, 명시용)",
  )
  return parser.parse_args()


async def run_once(
  *,
  batch_size: int,
  limit: int | None,
  concurrency: int | None,
  config: SemanticVectorConfig,
) -> None:
  status_before = get_semantic_analysis_status(config=config)
  logger.info(
    "semantic status before: analyzed=%s pending=%s no_image=%s",
    status_before["analyzed_count"],
    status_before["pending_count"],
    status_before["no_image_count"],
  )
  if status_before["pending_count"] == 0:
    print("semantic auto-sync: 대기 중인 장소 없음")
    return

  result = await sync_pending_semantic_vectors(
    batch_size=batch_size,
    limit=limit,
    concurrency=concurrency,
    config=config,
  )
  status_after = get_semantic_analysis_status(config=config)
  print(
    "semantic auto-sync complete: "
    f"targets={result.total_count} success={result.success_count} "
    f"failed={result.failed_count} "
    f"pending_left={status_after['pending_count']}"
  )


async def run_watch(
  *,
  batch_size: int,
  limit: int | None,
  concurrency: int | None,
  interval_seconds: float,
  config: SemanticVectorConfig,
) -> None:
  logger.info(
    "semantic auto-sync watch started interval=%.1fs batch_size=%s",
    interval_seconds,
    batch_size,
  )
  while True:
    try:
      await run_once(
        batch_size=batch_size,
        limit=limit,
        concurrency=concurrency,
        config=config,
      )
    except Exception:
      logger.exception("semantic auto-sync cycle failed; will retry after interval")
    await asyncio.sleep(interval_seconds)


def main() -> None:
  logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
  args = parse_args()
  config = SemanticVectorConfig()

  if args.watch:
    asyncio.run(
      run_watch(
        batch_size=args.batch_size,
        limit=args.limit,
        concurrency=args.concurrency,
        interval_seconds=args.interval_seconds,
        config=config,
      )
    )
    return

  asyncio.run(
    run_once(
      batch_size=args.batch_size,
      limit=args.limit,
      concurrency=args.concurrency,
      config=config,
    )
  )


if __name__ == "__main__":
  main()
