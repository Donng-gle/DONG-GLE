"""seed_onboarding_cards 선정 로직 테스트."""

from __future__ import annotations

from pipeline.seed_onboarding_cards import (
  MAJOR_TAG_ORDER,
  build_onboarding_cards,
  select_pool_images,
  select_seed_images,
  summarize_coverage,
)


def _scores(**overrides: float) -> dict[str, float]:
  base = {tag: 0.3 for tag in MAJOR_TAG_ORDER}
  base.update(overrides)
  return base


def _image(place_id: int, image_url: str, **overrides: float) -> dict:
  return {"place_id": place_id, "image_url": image_url, "scores": _scores(**overrides)}


def test_select_seed_images_picks_top_per_tag() -> None:
  images = [
    _image(1, "a.jpg", relaxing=0.9),
    _image(2, "b.jpg", lively=0.9),
    _image(3, "c.jpg", romantic=0.9),
    _image(4, "d.jpg", local=0.9),
    _image(5, "e.jpg", photogenic=0.9),
    _image(6, "f.jpg", traditional=0.9),
    _image(7, "g.jpg", modern=0.9),
  ]

  seeds = select_seed_images(images)

  assert len(seeds) == 7
  assert seeds["relaxing"]["image_url"] == "a.jpg"
  assert seeds["modern"]["image_url"] == "g.jpg"


def test_select_seed_images_avoids_duplicate_image_across_tags() -> None:
  # 한 이미지가 두 태그(relaxing, lively) 모두에서 1등인 경우
  images = [
    _image(1, "dual.jpg", relaxing=0.95, lively=0.95),
    _image(2, "b.jpg", lively=0.8),
    _image(3, "c.jpg", romantic=0.5),
    _image(4, "d.jpg", local=0.5),
    _image(5, "e.jpg", photogenic=0.5),
    _image(6, "f.jpg", traditional=0.5),
    _image(7, "g.jpg", modern=0.5),
  ]

  seeds = select_seed_images(images)

  assert len(seeds) == 7
  seed_keys = {(img["place_id"], img["image_url"]) for img in seeds.values()}
  assert len(seed_keys) == 7  # 이미지 중복 없이 7장 전부 서로 다름
  # dual.jpg는 두 태그 중 하나에만 배정됨
  assigned_to = [tag for tag, img in seeds.items() if img["image_url"] == "dual.jpg"]
  assert len(assigned_to) == 1


def test_select_pool_images_uses_rank_not_absolute_threshold() -> None:
  # romantic 점수가 전부 낮아도(threshold 미달) 순위 기준으로 상위 N장은 항상 뽑힘
  images = [_image(i, f"{i}.jpg", romantic=0.1 + i * 0.01) for i in range(20)]

  pool = select_pool_images(images, pool_size_per_tag=5)

  romantic_ranked = sorted(images, key=lambda img: img["scores"]["romantic"], reverse=True)
  expected_top5_urls = {img["image_url"] for img in romantic_ranked[:5]}
  pool_urls = {img["image_url"] for img in pool.values()}
  assert expected_top5_urls <= pool_urls


def test_build_onboarding_cards_marks_is_seed_correctly() -> None:
  images = [
    _image(1, "a.jpg", relaxing=0.9),
    _image(2, "b.jpg", lively=0.9),
    _image(3, "c.jpg", romantic=0.9),
    _image(4, "d.jpg", local=0.9),
    _image(5, "e.jpg", photogenic=0.9),
    _image(6, "f.jpg", traditional=0.9),
    _image(7, "g.jpg", modern=0.9),
    _image(8, "h.jpg"),  # 시드 아닌 일반 풀 이미지
  ]

  rows = build_onboarding_cards(images, pool_size_per_tag=5)

  seed_rows = [row for row in rows if row["is_seed"]]
  assert len(seed_rows) == 7
  # 모든 row가 7개 태그 컬럼을 다 갖고 있어야 함
  for row in rows:
    for tag in MAJOR_TAG_ORDER:
      assert tag in row


def test_summarize_coverage_counts_threshold() -> None:
  rows = [
    {**{tag: 0.9 for tag in MAJOR_TAG_ORDER}, "is_seed": True},
    {**{tag: 0.1 for tag in MAJOR_TAG_ORDER}, "is_seed": False},
  ]

  coverage = summarize_coverage(rows)

  assert coverage["relaxing"] == 1
