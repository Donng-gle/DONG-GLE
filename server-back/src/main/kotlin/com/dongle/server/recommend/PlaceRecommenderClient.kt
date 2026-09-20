package com.dongle.server.recommend

import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException

// ai/place_recommender(김지광, ai/api/app.py FastAPI 서비스로 배포)를 감싸는 HTTP 클라이언트.
// 요청/응답 계약은 ai/place_recommender/models.py의 RecommendRequest/RecommendResponse와 1:1 대응.
@Component
class PlaceRecommenderClient(
    private val placeRecommenderRestClient: RestClient,
) {
    fun recommend(request: RecommendRequest): RecommendResponse =
        try {
            placeRecommenderRestClient.post()
                .uri(RECOMMEND_PATH)
                .body(request)
                .retrieve()
                .body(RecommendResponse::class.java)
                ?: throw PlaceRecommenderUpstreamException(IllegalStateException("빈 응답 본문"))
        } catch (e: RestClientException) {
            // GlobalExceptionHandler가 PlaceRecommenderUpstreamException을 502로만 변환하고 원인은
            // 로깅하지 않아서, 연결 실패/타임아웃/AI 서버가 4xx로 거절한 것 중 뭔지 로그로 전혀
            // 구분이 안 됐음(2026-09-12, 실기기 재현 시 Render 로그에 흔적이 아예 없었음 — 사용자
            // 리포트). 원인(e)까지 같이 남겨서 다음 실패 때 실제 원인이 보이게 함
            logger.error("AI 장소 추천 서비스 호출 실패 (request=$request)", e)
            throw PlaceRecommenderUpstreamException(e)
        }

    companion object {
        private val logger = LoggerFactory.getLogger(PlaceRecommenderClient::class.java)
        private const val RECOMMEND_PATH = "/v1/places/recommend"
    }
}
