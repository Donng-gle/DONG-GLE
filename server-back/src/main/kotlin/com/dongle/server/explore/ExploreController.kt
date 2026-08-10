package com.dongle.server.explore

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
}
