package com.dongle.server.course.directions

// legs.size == waypoints.size - 1 (연속된 지점 사이 구간 하나씩)
data class RouteResult(
    val totalDistanceMeters: Int,
    val totalDurationSeconds: Int,
    val legs: List<RouteLegResult>,
    val encodedPolyline: String?,
)
