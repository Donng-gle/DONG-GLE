"""hiddenness 모듈 테스트."""

from __future__ import annotations

from hidden_score.hiddenness import (
    calculate_google_hiddenness,
    calculate_hiddenness,
    calculate_tourism_hiddenness,
)
from hidden_score.models import HiddenScoreConfig


def test_google_hiddenness_bounds() -> None:
    assert calculate_google_hiddenness(0.0) == 1.0
    assert calculate_google_hiddenness(1.0) == 0.0


def test_tourism_hiddenness_bounds() -> None:
    assert calculate_tourism_hiddenness(0.0) == 1.0
    assert calculate_tourism_hiddenness(1.0) == 0.0


def test_default_weighted_hiddenness() -> None:
    config = HiddenScoreConfig()
    hiddenness = calculate_hiddenness(1.0, 1.0, config)
    assert hiddenness == 1.0
    hiddenness = calculate_hiddenness(0.0, 0.0, config)
    assert hiddenness == 0.0
    hiddenness = calculate_hiddenness(1.0, 0.0, config)
    assert hiddenness == 0.6


def test_custom_weights() -> None:
    config = HiddenScoreConfig(
        google_hiddenness_weight=0.7,
        tourism_hiddenness_weight=0.3,
    )
    hiddenness = calculate_hiddenness(0.8, 0.4, config)
    assert hiddenness == 0.7 * 0.8 + 0.3 * 0.4


def test_hiddenness_clamped() -> None:
    config = HiddenScoreConfig()
    hiddenness = calculate_hiddenness(1.5, -0.2, config)
    assert 0.0 <= hiddenness <= 1.0
