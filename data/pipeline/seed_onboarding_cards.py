"""place_image_semantic_vector를 기준으로 onboarding_card를 시드한다.

선정 로직:
  1. 시드 7장(is_seed=true): 태그별로 그 태그 점수가 가장 높은 이미지 1장.
     같은 이미지가 여러 태그의 1등일 수 있어, 후보 이미지가 적은(희소한) 태그부터
     먼저 배정한다(0.6 이상 스코어 이미지 개수 오름차순).
  2. 일반 풀(is_seed=false): 태그별 상위 POOL_SIZE_PER_TAG장을 순위 기준으로 뽑아 합집합.
     절대 점수가 아니라 순위 기준이라, 후보가 적은 태그(romantic 등)도 항상
     POOL_SIZE_PER_TAG장을 확보한다 (schema.sql 주석의 "태그별 최소 4장" 제약보다 넉넉히 확보).
  3. 시드 이미지도 자연히 자신이 1등인 태그의 풀에 포함된다 (별도 제외 처리 안 함).

기존 onboarding_card는 placeholder(임의 점수, place_id 없음)라 전량 교체한다.
onboarding_swipe_log가 CASCADE로 함께 삭제되니 반드시 --execute로만 실행할 것.
"""

from __future__ import annotations

import argparse
from collections.abc import Sequence
from typing import Any

from pipeline.db import get_connection

MAJOR_TAG_ORDER = [
    "relaxing",
    "lively",
    "romantic",
    "local",
    "photogenic",
    "traditional",
    "modern",
]

SCARCITY_THRESHOLD = 0.6
POOL_SIZE_PER_TAG = 15

INSERT_SQL = """
INSERT INTO onboarding_card (
    place_id, image_url, is_seed,
    relaxing, lively, romantic, local, photogenic, traditional, modern
) VALUES (
    %(place_id)s, %(image_url)s, %(is_seed)s,
    %(relaxing)s, %(lively)s, %(romantic)s, %(local)s, %(photogenic)s, %(traditional)s, %(modern)s
);
"""


def _load_images(cur) -> list[dict[str, Any]]:
  """place_image_semantic_vector 전체를 (place_id, image_url, major_scores) 형태로 조회한다."""
  cur.execute("SELECT place_id, image_url, major_scores FROM place_image_semantic_vector")
  images = []
  for place_id, image_url, major_scores in cur.fetchall():
    images.append(
      {
        "place_id": place_id,
        "image_url": image_url,
        "scores": major_scores,
      }
    )
  return images


def _tag_scarcity_order(images: Sequence[dict[str, Any]]) -> list[str]:
  """태그별 score>=SCARCITY_THRESHOLD 이미지 수가 적은 순으로 태그를 정렬한다."""
  counts = {tag: 0 for tag in MAJOR_TAG_ORDER}
  for image in images:
    for tag in MAJOR_TAG_ORDER:
      if image["scores"][tag] >= SCARCITY_THRESHOLD:
        counts[tag] += 1
  return sorted(MAJOR_TAG_ORDER, key=lambda tag: counts[tag])


def _image_key(image: dict[str, Any]) -> tuple[int, str]:
  return (image["place_id"], image["image_url"])


def select_seed_images(images: Sequence[dict[str, Any]]) -> dict[str, dict[str, Any]]:
  """태그별 대표 시드 이미지 1장씩 선택한다. 반환값: {tag: image}."""
  used_keys: set[tuple[int, str]] = set()
  seeds: dict[str, dict[str, Any]] = {}

  for tag in _tag_scarcity_order(images):
    candidates = sorted(images, key=lambda img: img["scores"][tag], reverse=True)
    for candidate in candidates:
      if _image_key(candidate) not in used_keys:
        seeds[tag] = candidate
        used_keys.add(_image_key(candidate))
        break

  return seeds


def select_pool_images(
  images: Sequence[dict[str, Any]],
  *,
  pool_size_per_tag: int = POOL_SIZE_PER_TAG,
) -> dict[tuple[int, str], dict[str, Any]]:
  """태그별 상위 pool_size_per_tag장을 순위 기준으로 뽑아 (key -> image) 합집합을 만든다."""
  pool: dict[tuple[int, str], dict[str, Any]] = {}
  for tag in MAJOR_TAG_ORDER:
    ranked = sorted(images, key=lambda img: img["scores"][tag], reverse=True)
    for image in ranked[:pool_size_per_tag]:
      pool[_image_key(image)] = image
  return pool


def build_onboarding_cards(
  images: Sequence[dict[str, Any]],
  *,
  pool_size_per_tag: int = POOL_SIZE_PER_TAG,
) -> list[dict[str, Any]]:
  """DB insert용 onboarding_card row 목록을 만든다."""
  seeds = select_seed_images(images)
  seed_keys = {_image_key(image) for image in seeds.values()}
  pool = select_pool_images(images, pool_size_per_tag=pool_size_per_tag)

  all_keys = seed_keys | set(pool.keys())
  images_by_key = {_image_key(image): image for image in images}

  rows = []
  for key in all_keys:
    image = images_by_key[key]
    row = {
      "place_id": image["place_id"],
      "image_url": image["image_url"],
      "is_seed": key in seed_keys,
    }
    row.update({tag: image["scores"][tag] for tag in MAJOR_TAG_ORDER})
    rows.append(row)

  return rows


def summarize_coverage(rows: Sequence[dict[str, Any]]) -> dict[str, int]:
  """태그별 score>=SCARCITY_THRESHOLD 카드 수를 집계한다 (품질 확인용)."""
  return {
    tag: sum(1 for row in rows if row[tag] >= SCARCITY_THRESHOLD) for tag in MAJOR_TAG_ORDER
  }


def seed_onboarding_cards(*, execute: bool, pool_size_per_tag: int = POOL_SIZE_PER_TAG) -> None:
  with get_connection() as conn:
    with conn.cursor() as cur:
      images = _load_images(cur)
      if not images:
        print("place_image_semantic_vector가 비어있습니다. 백필을 먼저 실행하세요.")
        return

      seeds = select_seed_images(images)
      rows = build_onboarding_cards(images, pool_size_per_tag=pool_size_per_tag)
      seed_rows = [row for row in rows if row["is_seed"]]
      coverage = summarize_coverage(rows)

      print(f"분석된 이미지: {len(images)}장")
      print(f"생성할 카드: {len(rows)}장 (시드 {len(seed_rows)}장 포함)")
      print(f"태그별 커버리지(score>={SCARCITY_THRESHOLD}): {coverage}")
      print("시드 카드:")
      for tag in MAJOR_TAG_ORDER:
        image = seeds[tag]
        print(f"  {tag}: place_id={image['place_id']} score={image['scores'][tag]:.2f} {image['image_url']}")

      if not execute:
        print("\n--dry-run 모드입니다. 실제 반영하려면 --execute를 붙여 실행하세요.")
        return

      cur.execute("SELECT COUNT(*) FROM onboarding_card")
      (existing_count,) = cur.fetchone()
      cur.execute("DELETE FROM onboarding_card")
      print(f"\n기존 onboarding_card {existing_count}건 삭제 (연결된 onboarding_swipe_log도 CASCADE 삭제됨)")

      for row in rows:
        cur.execute(INSERT_SQL, row)

      print(f"onboarding_card {len(rows)}건 적재 완료")


def main() -> None:
  parser = argparse.ArgumentParser(description="place_image_semantic_vector 기반 onboarding_card 시드")
  parser.add_argument(
    "--execute",
    action="store_true",
    help="실제로 DELETE+INSERT를 실행한다. 없으면 dry-run(집계만 출력).",
  )
  parser.add_argument(
    "--pool-size-per-tag",
    type=int,
    default=POOL_SIZE_PER_TAG,
    help="태그별 일반 풀 후보 수 (기본 15)",
  )
  args = parser.parse_args()
  seed_onboarding_cards(execute=args.execute, pool_size_per_tag=args.pool_size_per_tag)


if __name__ == "__main__":
  main()
