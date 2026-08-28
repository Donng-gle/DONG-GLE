"""공통 숫자 검증 및 보조 함수."""

from __future__ import annotations

import math


def clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    """값을 지정 범위로 제한한다."""
    return max(minimum, min(maximum, value))


def validate_weight_sum(*weights: float, tolerance: float = 1e-9) -> None:
    """가중치 합이 1.0인지 검증한다."""
    total = sum(weights)
    if not math.isclose(total, 1.0, abs_tol=tolerance):
        raise ValueError(f"weight sum must be 1.0, got {total}")


def ensure_finite(value: float, field_name: str) -> float:
    """NaN/inf 값을 거부한다."""
    if not math.isfinite(value):
        raise ValueError(f"{field_name} must be a finite number")
    return value
