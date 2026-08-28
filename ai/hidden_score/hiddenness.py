"""Hiddenness 계산."""

from __future__ import annotations

from hidden_score.models import HiddenScoreConfig
from hidden_score.validators import clamp, ensure_finite


def calculate_google_hiddenness(review_percentile: float) -> float:
    """Google 리뷰 기반 Hiddenness (0~1)."""
    ensure_finite(review_percentile, "review_percentile")
    return clamp(1.0 - review_percentile)


def calculate_tourism_hiddenness(tps: float) -> float:
    """관광 통계 기반 Hiddenness (0~1)."""
    ensure_finite(tps, "tps")
    return clamp(1.0 - tps)


def calculate_hiddenness(
    google_hiddenness: float,
    tourism_hiddenness: float,
    config: HiddenScoreConfig,
) -> float:
    """Google·관광 Hiddenness를 가중 결합한다."""
    ensure_finite(google_hiddenness, "google_hiddenness")
    ensure_finite(tourism_hiddenness, "tourism_hiddenness")

    hiddenness = (
        config.google_hiddenness_weight * google_hiddenness
        + config.tourism_hiddenness_weight * tourism_hiddenness
    )
    return clamp(hiddenness)
