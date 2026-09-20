package com.dongle.server.course.directions

import com.dongle.server.common.config.GoogleProperties
import com.dongle.server.course.optimizer.LatLng
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException

// Google Routes API v2(computeRoutes)를 감싸는 클라이언트. ai/course_optimizer/routes_client.py가 이미
// 같은 API를 내부 이동시간 행렬 계산용으로 쓰고 있어(김지광 파트), 같은 API를 재사용해 일관성을 맞춤.
// waypoints 순서는 이미 course_optimizer/사용자가 정한 방문 순서를 그대로 쓴다 — Google에 재최적화
// (waypoint optimize)를 요청하지 않음. AI가 이미 감성 점수·영업시간 등을 고려해 정한 순서를
// 순수 거리 기준으로 다시 흔들면 안 되기 때문 (api_1.3.1v.yaml 옛 스펙 문구와 달리 의도적으로 최적화 안 함).
//
// 실패해도 코스 자체는 보여줘야 하므로(이동거리/시간은 부가 정보) 예외를 던지지 않고 null로 폴백한다.
@Component
class GoogleRoutesClient(
    private val googleRoutesRestClient: RestClient,
    private val googleProperties: GoogleProperties,
) {
    fun computeRoute(waypoints: List<LatLng>, mode: GoogleTravelMode): RouteResult? {
        if (waypoints.size < 2) return null

        val request = ComputeRoutesRequest(
            origin = waypoints.first().toWaypoint(),
            destination = waypoints.last().toWaypoint(),
            intermediates = waypoints.subList(1, waypoints.size - 1).map { it.toWaypoint() },
            travelMode = mode.name,
        )

        return try {
            googleRoutesRestClient.post()
                .uri(COMPUTE_ROUTES_URL)
                .header("X-Goog-Api-Key", googleProperties.placesApiKey)
                .header("X-Goog-FieldMask", FIELD_MASK)
                .body(request)
                .retrieve()
                .body(ComputeRoutesResponse::class.java)
                ?.routes
                ?.firstOrNull()
                ?.toRouteResult()
        } catch (e: RestClientException) {
            logger.warn("Google Routes API 호출 실패, 이동거리/시간 없이 진행", e)
            null
        }
    }

    private fun LatLng.toWaypoint() = GoogleWaypoint(GoogleLocation(GoogleLatLng(latitude, longitude)))

    private fun GoogleRoute.toRouteResult() = RouteResult(
        totalDistanceMeters = distanceMeters ?: 0,
        totalDurationSeconds = duration.toSecondsOrZero(),
        legs = legs.map { RouteLegResult(distanceMeters = it.distanceMeters ?: 0, durationSeconds = it.duration.toSecondsOrZero()) },
        encodedPolyline = polyline?.encodedPolyline,
    )

    private fun String?.toSecondsOrZero(): Int = this?.removeSuffix("s")?.toIntOrNull() ?: 0

    companion object {
        private val logger = LoggerFactory.getLogger(GoogleRoutesClient::class.java)
        private const val COMPUTE_ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"
        private const val FIELD_MASK =
            "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.duration,routes.legs.distanceMeters"
    }
}
