"""Postgres place_image_semantic_vector 점수로 Qdrant를 이미지 단위 재색인한다.

VLM을 다시 호출하지 않는다. 이미 DB에 있는 이미지별 major/detail score로
vector를 만들어 upsert한다.

Usage:
  python scripts/reindex_qdrant_from_image_scores.py [--reset-qdrant]
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

from pipeline.db import get_connection  # noqa: E402
from semantic_vector.config import SemanticVectorConfig  # noqa: E402
from semantic_vector.models import (  # noqa: E402
  DetailScores,
  MajorScores,
  PlaceImageInput,
  SemanticVectorResult,
)
from semantic_vector.point_id import build_point_id  # noqa: E402
from semantic_vector.qdrant_repository import (  # noqa: E402
  ensure_collection_exists,
  upsert_semantic_vector,
)
from semantic_vector.vector_builder import build_detail_vector, build_major_vector  # noqa: E402

logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(
    description="Reindex Qdrant from place_image_semantic_vector (no VLM)"
  )
  parser.add_argument(
    "--reset-qdrant",
    action="store_true",
    help="기존 collection 삭제 후 재생성",
  )
  parser.add_argument("--batch-size", type=int, default=50)
  parser.add_argument("--limit", type=int, default=None)
  return parser.parse_args()


async def _reset_qdrant_collection(config: SemanticVectorConfig) -> None:
  from qdrant_client import AsyncQdrantClient

  client = AsyncQdrantClient(url=config.qdrant_url, api_key=config.qdrant_api_key)
  exists = await client.collection_exists(config.qdrant_collection_name)
  if exists:
    await client.delete_collection(config.qdrant_collection_name)
    print(f"deleted qdrant collection: {config.qdrant_collection_name}")
  await ensure_collection_exists(config)
  print(f"recreated qdrant collection: {config.qdrant_collection_name}")


def _load_image_score_rows(*, limit: int | None = None) -> list[dict]:
  with get_connection() as conn:
    with conn.cursor() as cur:
      sql = """
        SELECT
            piv.place_id,
            piv.image_url,
            piv.detail_scores,
            piv.major_scores,
            piv.summary,
            piv.model_name,
            piv.prompt_version,
            piv.tag_schema_version,
            p.name,
            p.category::text AS category
        FROM place_image_semantic_vector piv
        JOIN place p ON p.id = piv.place_id
        ORDER BY piv.place_id, piv.image_url
      """
      if limit is not None:
        sql += " LIMIT %s"
        cur.execute(sql, (limit,))
      else:
        cur.execute(sql)
      columns = [desc[0] for desc in cur.description]
      return [dict(zip(columns, row)) for row in cur.fetchall()]


def _image_id_for_place_url(rows_for_place: list[dict], image_url: str) -> str:
  place_id = str(rows_for_place[0]["place_id"])
  for index, row in enumerate(rows_for_place):
    if row["image_url"] == image_url:
      return f"{place_id}-img{index + 1}"
  return f"{place_id}-img1"


async def reindex(
  *,
  reset_qdrant: bool = True,
  batch_size: int = 50,
  limit: int | None = None,
) -> None:
  config = SemanticVectorConfig()
  if reset_qdrant:
    await _reset_qdrant_collection(config)
  else:
    await ensure_collection_exists(config)

  rows = _load_image_score_rows(limit=limit)
  if not rows:
    print("no place_image_semantic_vector rows to index")
    return

  by_place: dict[int, list[dict]] = {}
  for row in rows:
    by_place.setdefault(int(row["place_id"]), []).append(row)

  success = 0
  failed = 0
  pending: list[tuple[SemanticVectorResult, PlaceImageInput]] = []

  for place_id, place_rows in by_place.items():
    for row in place_rows:
      try:
        image_id = _image_id_for_place_url(place_rows, row["image_url"])
        detail = DetailScores.model_validate(row["detail_scores"])
        major = MajorScores.model_validate(row["major_scores"])
        detail_vector = build_detail_vector(detail)
        major_vector = build_major_vector(major)
        input_data = PlaceImageInput(
          place_id=str(place_id),
          image_id=image_id,
          image_url=row["image_url"],
          analysis_image_urls=[row["image_url"]],
          name=row.get("name"),
          category=row.get("category"),
        )
        result = SemanticVectorResult(
          place_id=str(place_id),
          image_id=image_id,
          detail_scores=detail,
          major_scores=major,
          detail_vector=detail_vector,
          major_vector=major_vector,
          summary=row.get("summary"),
          model_name=row["model_name"],
          prompt_version=row["prompt_version"],
          tag_schema_version=row["tag_schema_version"],
          qdrant_point_id=build_point_id(str(place_id), image_id),
        )
        pending.append((result, input_data))
      except Exception as error:  # noqa: BLE001
        failed += 1
        logger.error(
          "skip place_id=%s url=%s error=%s",
          place_id,
          row.get("image_url"),
          error,
        )

  for start in range(0, len(pending), batch_size):
    batch = pending[start : start + batch_size]
    for result, input_data in batch:
      try:
        await upsert_semantic_vector(result, input_data, config=config)
        success += 1
      except Exception as error:  # noqa: BLE001
        failed += 1
        logger.error(
          "upsert failed place_id=%s image_id=%s error=%s",
          result.place_id,
          result.image_id,
          error,
        )
    print(
      f"batch={start // batch_size + 1} "
      f"upserted={min(start + batch_size, len(pending))}/{len(pending)}"
    )

  print(
    f"qdrant image reindex complete: "
    f"targets={len(pending)} success={success} failed={failed}"
  )


def main() -> None:
  logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
  args = parse_args()
  asyncio.run(
    reindex(
      reset_qdrant=args.reset_qdrant,
      batch_size=args.batch_size,
      limit=args.limit,
    )
  )


if __name__ == "__main__":
  main()
