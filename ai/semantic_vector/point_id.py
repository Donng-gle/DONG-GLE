"""Qdrant Point ID 생성."""

from __future__ import annotations

import uuid

_POINT_NAMESPACE = uuid.UUID("6ba7b811-9dad-11d1-80b4-00c04fd430c8")


def build_point_id(place_id: str) -> str:
  """장소 ID를 Qdrant Point ID로 변환한다."""
  try:
    uuid.UUID(place_id)
    return place_id
  except ValueError:
    return str(uuid.uuid5(_POINT_NAMESPACE, place_id))
