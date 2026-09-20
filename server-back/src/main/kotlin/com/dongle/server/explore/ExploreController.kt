package com.dongle.server.explore

import com.dongle.server.explore.dto.SimilarCoursesResponse
import com.dongle.server.explore.dto.SimilarLogsResponse
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/explore")
class ExploreController(
    private val exploreService: ExploreService,
) {
    @GetMapping("/similar-logs")
    fun similarLogs(
        authentication: Authentication,
        @RequestParam(required = false) bounds: String?,
        @RequestParam(defaultValue = "50") limit: Int,
    ): SimilarLogsResponse {
        val parts = bounds?.split(",")?.map { it.trim().toDouble() }

        return exploreService.similarLogs(
            userId = authentication.principal as Long,
            swLat = parts?.get(0),
            swLng = parts?.get(1),
            neLat = parts?.get(2),
            neLng = parts?.get(3),
            limit = limit,
        )
    }

    // "취향 맞춤 코스" 탭 카드 목록(2026-09-07 결정, decision-log 참고)
    @GetMapping("/similar-courses")
    fun similarCourses(
        authentication: Authentication,
        @RequestParam(defaultValue = "20") limit: Int,
    ): SimilarCoursesResponse = exploreService.similarCourses(authentication.principal as Long, limit)
}
