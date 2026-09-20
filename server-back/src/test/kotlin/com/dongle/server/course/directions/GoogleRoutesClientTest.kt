package com.dongle.server.course.directions

import com.dongle.server.common.config.GoogleProperties
import com.dongle.server.course.optimizer.LatLng
import org.junit.jupiter.api.Test
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.header
import org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath
import org.springframework.test.web.client.match.MockRestRequestMatchers.method
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withServerError
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient
import kotlin.test.assertEquals
import kotlin.test.assertNull

// 실제 Google Routes API 없이 요청/응답 계약만 검증하는 순수 단위 테스트.
// CourseOptimizerClientTest와 동일하게 MockRestServiceServer로 HTTP 레이어를 가로챈다.
// Google Routes API는 카멜케이스 JSON 그대로라 별도 SNAKE_CASE 컨버터가 필요 없음(RestClient.create() 기본값 그대로).
class GoogleRoutesClientTest {

    private fun newClientBoundTo(): Pair<GoogleRoutesClient, MockRestServiceServer> {
        val builder = RestClient.builder()
        val mockServer = MockRestServiceServer.bindTo(builder).build()
        val client = GoogleRoutesClient(builder.build(), GoogleProperties(placesApiKey = "test-key"))
        return client to mockServer
    }

    @Test
    fun `waypoint 순서 그대로 경로를 요청하고 legs를 파싱한다`() {
        val (client, mockServer) = newClientBoundTo()

        mockServer.expect(requestTo("https://routes.googleapis.com/directions/v2:computeRoutes"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header("X-Goog-Api-Key", "test-key"))
            .andExpect(jsonPath("$.travelMode").value("WALK"))
            .andExpect(jsonPath("$.origin.location.latLng.latitude").value(36.5))
            .andExpect(jsonPath("$.intermediates[0].location.latLng.latitude").value(36.51))
            .andExpect(jsonPath("$.destination.location.latLng.latitude").value(36.52))
            .andRespond(
                withSuccess(
                    """
                    {
                      "routes": [{
                        "distanceMeters": 3000,
                        "duration": "900s",
                        "polyline": {"encodedPolyline": "xyz"},
                        "legs": [
                          {"distanceMeters": 1000, "duration": "300s"},
                          {"distanceMeters": 2000, "duration": "600s"}
                        ]
                      }]
                    }
                    """.trimIndent(),
                    MediaType.APPLICATION_JSON,
                )
            )

        val result = client.computeRoute(
            listOf(
                LatLng(36.5, 128.5),
                LatLng(36.51, 128.51),
                LatLng(36.52, 128.52),
            ),
            GoogleTravelMode.WALK,
        )

        assertEquals(3000, result?.totalDistanceMeters)
        assertEquals(900, result?.totalDurationSeconds)
        assertEquals("xyz", result?.encodedPolyline)
        assertEquals(2, result?.legs?.size)
        assertEquals(300, result?.legs?.get(0)?.durationSeconds)

        mockServer.verify()
    }

    @Test
    fun `업스트림 오류가 나면 예외를 던지지 않고 null을 반환한다`() {
        val (client, mockServer) = newClientBoundTo()

        mockServer.expect(requestTo("https://routes.googleapis.com/directions/v2:computeRoutes"))
            .andRespond(withServerError())

        val result = client.computeRoute(listOf(LatLng(36.5, 128.5), LatLng(36.51, 128.51)), GoogleTravelMode.DRIVE)

        assertNull(result)
    }

    @Test
    fun `지점이 1개 이하면 API를 호출하지 않고 null을 반환한다`() {
        val (client, _) = newClientBoundTo()

        assertNull(client.computeRoute(listOf(LatLng(36.5, 128.5)), GoogleTravelMode.WALK))
        assertNull(client.computeRoute(emptyList(), GoogleTravelMode.WALK))
    }
}
