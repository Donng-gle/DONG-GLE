package com.dongle.server.course.optimizer

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
import java.time.LocalDateTime
import kotlin.test.assertEquals

// 실제 AI 서비스(ai/course_optimizer, 아직 미배포) 없이 요청/응답 계약만 검증하는 순수 단위 테스트.
// MockRestServiceServer로 HTTP 레이어를 가로채기 때문에 서버 기동이 전혀 필요 없다.
// 앱 전역 Jackson 설정(application.yml의 SNAKE_CASE)을 그대로 재현해야 실제 운영 경로와 동일하게 검증되므로,
// RestClient.builder()의 프레임워크 기본 컨버터 대신 SNAKE_CASE로 맞춘 JacksonJsonHttpMessageConverter를 직접 꽂는다.
class CourseOptimizerClientTest {

    private fun newClientBoundTo(): Pair<CourseOptimizerClient, MockRestServiceServer> {
        val mapper = JsonMapper.builder()
            .propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
            .build()
        val builder = RestClient.builder()
            .baseUrl("http://test-course-optimizer")
            .messageConverters { it.add(0, JacksonJsonHttpMessageConverter(mapper)) }

        val mockServer = MockRestServiceServer.bindTo(builder).build()
        return CourseOptimizerClient(builder.build()) to mockServer
    }

    private fun sampleTripInput() = TripInput(
        startTime = LocalDateTime.of(2026, 9, 1, 9, 0),
        endTime = LocalDateTime.of(2026, 9, 1, 18, 0),
        transportMode = TransportMode.walk,
        origin = LatLng(latitude = 36.5684, longitude = 128.7294),
        candidates = listOf(
            CandidatePlace(
                placeId = "1",
                category = "관광지",
                majorScores = MajorScores(
                    relaxing = 0.8,
                    lively = 0.2,
                    romantic = 0.3,
                    local = 0.5,
                    photogenic = 0.7,
                    traditional = 0.6,
                    modern = 0.1,
                ),
                latitude = 36.5389,
                longitude = 128.5169,
                name = "하회마을",
            )
        ),
    )

    @Test
    fun `요청을 올바른 형태로 보내고 응답을 CourseOptimizationResult로 파싱한다`() {
        val (client, mockServer) = newClientBoundTo()

        mockServer.expect(requestTo("http://test-course-optimizer/optimize"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(jsonPath("$.transport_mode").value("walk"))
            .andExpect(jsonPath("$.candidates[0].place_id").value("1"))
            .andExpect(jsonPath("$.candidates[0].major_scores.relaxing").value(0.8))
            .andRespond(
                withSuccess(
                    """
                    {
                      "selected_route": {
                        "stops": [
                          {
                            "place_id": "1",
                            "arrival_time": "2026-09-01T09:30:00",
                            "visit_start_time": "2026-09-01T09:30:00",
                            "departure_time": "2026-09-01T10:30:00",
                            "actual_stay_minutes": 60
                          }
                        ],
                        "score": {
                          "time_score": 0.8,
                          "transition_score": 0.7,
                          "balance_score": 0.6,
                          "experience_score": 0.75,
                          "total_travel_minutes": 20,
                          "travel_score": 0.9,
                          "total_score": 0.82
                        }
                      },
                      "candidate_route_count": 4,
                      "evaluated_route_count": 4,
                      "target_visit_count": 1,
                      "free_time_minutes": 30,
                      "prompt_version": "course-eval-v1",
                      "model_name": "gpt-4.1-mini",
                      "excluded_place_ids": [],
                      "excluded_places": [],
                      "exclusion_reason": {},
                      "replaced_places": {}
                    }
                    """.trimIndent(),
                    MediaType.APPLICATION_JSON,
                )
            )

        val result = client.optimizeCourse(sampleTripInput())

        assertEquals(1, result.selectedRoute.stops.size)
        assertEquals("1", result.selectedRoute.stops[0].placeId)
        assertEquals(60, result.selectedRoute.stops[0].actualStayMinutes)
        assertEquals(0.82, result.selectedRoute.score.totalScore)
        assertEquals("course-eval-v1", result.promptVersion)
        assertEquals(30, result.freeTimeMinutes)

        mockServer.verify()
    }

    @Test
    fun `업스트림 서버가 오류를 반환하면 CourseOptimizerUpstreamException을 던진다`() {
        val (client, mockServer) = newClientBoundTo()

        mockServer.expect(requestTo("http://test-course-optimizer/optimize"))
            .andRespond(withServerError())

        assertThrows<CourseOptimizerUpstreamException> {
            client.optimizeCourse(sampleTripInput())
        }
    }
}
