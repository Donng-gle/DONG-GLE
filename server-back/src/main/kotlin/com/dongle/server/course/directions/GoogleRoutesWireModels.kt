package com.dongle.server.course.directions

// Google Routes API v2(computeRoutes) 요청/응답 JSON 구조 그대로.
// ai/course_optimizer/routes_client.py가 이미 같은 API를 쓰고 있어 그 요청 형식을 그대로 따름.
// 카멜케이스 그대로가 Google API 실제 필드명이라, 이 프로젝트의 전역 SNAKE_CASE Jackson 설정을 적용하면 안 됨
// — RestClient.builder()의 기본(정적 팩토리) 컨버터는 전역 설정을 안 물려받으므로 별도 설정 없이 그대로 사용

data class GoogleLatLng(
    val latitude: Double,
    val longitude: Double,
)

data class GoogleLocation(
    val latLng: GoogleLatLng,
)

data class GoogleWaypoint(
    val location: GoogleLocation,
)

data class ComputeRoutesRequest(
    val origin: GoogleWaypoint,
    val destination: GoogleWaypoint,
    val intermediates: List<GoogleWaypoint> = emptyList(),
    val travelMode: String,
)

data class GoogleRoutePolyline(
    val encodedPolyline: String? = null,
)

data class GoogleRouteLeg(
    val distanceMeters: Int? = null,
    val duration: String? = null, // "1234s" 형태
)

data class GoogleRoute(
    val distanceMeters: Int? = null,
    val duration: String? = null,
    val polyline: GoogleRoutePolyline? = null,
    val legs: List<GoogleRouteLeg> = emptyList(),
)

data class ComputeRoutesResponse(
    val routes: List<GoogleRoute> = emptyList(),
)
