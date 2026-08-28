"""load_places는 DB 적재만 하고 semantic 분석은 호출하지 않는다."""

from __future__ import annotations

import ast
from pathlib import Path
from unittest.mock import patch

from pipeline.load_places import main

LOAD_PLACES_PATH = Path(__file__).resolve().parents[1] / "pipeline" / "load_places.py"


def test_load_places_source_does_not_import_semantic_or_ai_sdk() -> None:
  source = LOAD_PLACES_PATH.read_text()
  tree = ast.parse(source)
  imported_modules: list[str] = []
  for node in ast.walk(tree):
    if isinstance(node, ast.Import):
      imported_modules.extend(alias.name for alias in node.names)
    elif isinstance(node, ast.ImportFrom) and node.module:
      imported_modules.append(node.module)

  assert "pipeline.semantic_vector_sync" not in imported_modules
  assert all(
    module != "semantic_vector" and not module.startswith("semantic_vector.")
    for module in imported_modules
  )
  assert "openai" not in imported_modules
  assert "qdrant_client" not in imported_modules


def test_main_saves_places_without_calling_semantic_sync() -> None:
  saved_places = [
    {
      "id": 1,
      "content_id": "1001",
      "name": "월영교",
      "category": "관광지",
      "main_image_url": "https://example.com/1.jpg",
    }
  ]

  with (
    patch("pipeline.load_places.load_raw", return_value=([], {}, {}, {}, {})),
    patch(
      "pipeline.load_places.save_places_to_db",
      return_value=(saved_places, 0),
    ) as save_mock,
  ):
    main()

  save_mock.assert_called_once()
  import pipeline.load_places as load_places_module

  assert not hasattr(load_places_module, "run_semantic_vector_sync")
  assert not hasattr(load_places_module, "summarize_saved_places_for_semantic")
