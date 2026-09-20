"""Qdrant Point ID 생성."""

from __future__ import annotations

import uuid

_POINT_NAMESPACE = uuid.UUID("6ba7b811-9dad-11d1-80b4-00c04fd430c8")


def build_point_id(place_id: str, image_id: str | None = None) -> str:
  """place_id(+ image_id)를 Qdrant Point ID로 변환한다.

  이미지 단위 색인이 기본이다. image_id가 있으면 `place_id:image_id`로
  안정적 UUID5를 만든다. image_id가 없으면 place_id만 사용한다(하위 호환).
  """
  source = f"{place_id}:{image_id}" if image_id else place_id
  try:
    uuid.UUID(source)
    return source
  except ValueError:
    return str(uuid.uuid5(_POINT_NAMESPACE, source))
