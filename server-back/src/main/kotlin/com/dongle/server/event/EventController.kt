package com.dongle.server.event

import com.dongle.server.event.dto.EventsResponse
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/events")
class EventController(
    private val eventService: EventService,
) {
    @GetMapping
    fun listEvents(
        @RequestParam(required = false) month: String?,
        @RequestParam(defaultValue = "1") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): EventsResponse = eventService.listEvents(month, page, size)
}
