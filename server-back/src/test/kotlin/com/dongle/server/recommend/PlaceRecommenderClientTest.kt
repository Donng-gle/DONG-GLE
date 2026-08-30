package com.dongle.server.recommend

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath
import org.springframework.test.web.client.match.MockRestRequestMatchers.method
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withServerError
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient
import tools.jackson.databind.PropertyNamingStrategies
import tools.jackson.databind.json.JsonMapper
import kotlin.test.assertEquals

// 실제 AI 서비스(ai/place_recommender, ai/api/app.py) 없이 요청/응답 계약만 검증하는 순수 단위 테스트.
// CourseOptimizerClientTest와 동일한 이유로 MockRestServiceServer + SNAKE_CASE 컨버터를 직접 구성한다.
class PlaceRecommenderClientTest {

    private fun newClientBoundTo(): Pair<PlaceRecommenderClient, MockRestServiceServer> {
        val mapper = JsonMapper.builder()
            .propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
            .build()
        val builder = RestClient.builder()
            .baseUrl("http://test-place-recommender")
            .messageConverters { it.add(0, JacksonJsonHttpMessageConverter(mapper)) }

        val mockServer = MockRestServiceServer.bindTo(builder).build()
        return PlaceRecommenderClient(builder.build()) to mockServer
    }

    @Test
    fun `요청을 올바른 형태로 보내고 응답을 RecommendResponse로 파싱한다`() {
        val (client, mockServer) = newClientBoundTo()

        mockServer.expect(requestTo("http://test-place-recommender/v1/places/recommend"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(jsonPath("$.top_n").value(20))
            .andExpect(jsonPath("$.preferences[0].tag").value("relaxing"))
            .andExpect(jsonPath("$.preferences[0].score").value(0.9))
            .andRespond(
                withSuccess(
                    """
                    {
                      "recommendations": [
                        {
                          "place_id": "1",
                          "similarity_score": 0.82,
                          "hidden_score": 0.4,
                          "recommendation_score": 0.7
                        }
                      ]
                    }
                    """.trimIndent(),
                    MediaType.APPLICATION_JSON,
                )
            )

        val result = client.recommend(
            RecommendRequest(preferences = listOf(PreferenceTagItem(tag = "relaxing", score = 0.9)), topN = 20)
        )

        assertEquals(1, result.recommendations.size)
        assertEquals("1", result.recommendations[0].placeId)
        assertEquals(0.7, result.recommendations[0].recommendationScore)

        mockServer.verify()
    }

    @Test
    fun `업스트림 서버가 오류를 반환하면 PlaceRecommenderUpstreamException을 던진다`() {
        val (client, mockServer) = newClientBoundTo()

        mockServer.expect(requestTo("http://test-place-recommender/v1/places/recommend"))
            .andRespond(withServerError())

        assertThrows<PlaceRecommenderUpstreamException> {
            client.recommend(RecommendRequest(preferences = listOf(PreferenceTagItem(tag = "relaxing", score = 0.9)), topN = 20))
        }
    }
}
