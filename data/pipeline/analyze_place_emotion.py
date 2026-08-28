"""Deprecated: 감성태그 분석은 semantic_vector 파이프라인으로 이전되었다.

기존 threshold/count 기반 place_emotion_tag 적재는 사용하지 않는다.
raw score는 place_semantic_vector 테이블에 저장되며, 분석은 아래를 사용한다.

  python -m pipeline.load_places
  python scripts/backfill_semantic_vectors.py
"""

from __future__ import annotations

import sys


def main() -> None:
  print(
    "analyze_place_emotion.py는 더 이상 사용하지 않습니다.\n"
    "semantic 분석은 scripts/backfill_semantic_vectors.py 또는 "
    "scripts/auto_sync_semantic_vectors.py를 사용하세요."
  )
  sys.exit(1)


if __name__ == "__main__":
  main()
