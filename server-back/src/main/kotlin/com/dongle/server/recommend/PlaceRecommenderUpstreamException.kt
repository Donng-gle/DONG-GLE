package com.dongle.server.recommend

class PlaceRecommenderUpstreamException(cause: Throwable) :
    RuntimeException("AI 장소 추천 서비스 호출에 실패했습니다.", cause)
