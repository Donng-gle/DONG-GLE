package com.dongle.server.health

import com.dongle.server.health.dto.HealthResponse
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDateTime

@RestController
class HealthController {

    @GetMapping("/health")
    fun health(): HealthResponse = HealthResponse(status = "ok", version = API_VERSION, timestamp = LocalDateTime.now())

    companion object {
        private const val API_VERSION = "1.3.1"
    }
}
