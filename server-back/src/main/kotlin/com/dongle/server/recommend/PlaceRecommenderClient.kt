package com.dongle.server.recommend

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
            throw PlaceRecommenderUpstreamException(e)
        }

    companion object {
        private const val RECOMMEND_PATH = "/v1/places/recommend"
    }
}
