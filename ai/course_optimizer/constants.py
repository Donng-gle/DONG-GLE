"""시간대, 체류시간, 운영시간 fallback 상수."""

from __future__ import annotations

from datetime import time

TIME_SLOTS = {
  "morning": (time(6, 0), time(11, 0)),
  "lunch": (time(11, 0), time(14, 0)),
  "afternoon": (time(14, 0), time(18, 0)),
  "evening": (time(18, 0), time(22, 0)),
}

DEFAULT_STAY_MINUTES = {
  "attraction": 60,
  "cafe": 60,
  "restaurant": 60,
  "museum": 90,
  "market": 60,
  "park": 60,
  "night_view": 40,
}

MIN_STAY_MINUTES = {
  "attraction": 30,
  "cafe": 30,
  "restaurant": 40,
  "museum": 45,
  "market": 30,
  "park": 30,
  "night_view": 30,
}

OPERATING_HOURS_FALLBACK = {
  "attraction_outdoor": None,
  "attraction_indoor": (time(9, 0), time(18, 0)),
  "market": (time(9, 0), time(21, 0)),
  "cafe": (time(8, 0), time(22, 0)),
  "restaurant": (time(11, 0), time(21, 0)),
  "museum": (time(9, 0), time(18, 0)),
  "night_view": None,
}

# 상위 서비스 category(한글) -> 체류시간/운영시간 키(영문)
CATEGORY_PROFILE_MAP = {
  "관광지": "attraction",
  "식당": "restaurant",
  "카페": "cafe",
  "문화공간": "museum",
  "액티비티": "attraction",
  "축제행사": "market",
}

ORIGIN_NODE_ID = "__origin__"
DESTINATION_NODE_ID = "__destination__"
