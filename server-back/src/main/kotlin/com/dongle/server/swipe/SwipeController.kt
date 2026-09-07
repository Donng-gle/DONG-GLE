package com.dongle.server.swipe

import com.dongle.server.swipe.dto.SwipeCandidatesRequest
import com.dongle.server.swipe.dto.SwipeCandidatesResponse
import com.dongle.server.swipe.dto.SwipeResultRequest
import com.dongle.server.swipe.dto.SwipeSessionDetailResponse
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

@RestController
class SwipeController(
    private val swipeService: SwipeService,
) {
    @PostMapping("/swipe/candidates")
    fun getCandidates(
        authentication: Authentication,
        @Valid @RequestBody request: SwipeCandidatesRequest,
    ): SwipeCandidatesResponse = swipeService.createSession(authentication.userId(), request)

    @GetMapping("/swipe/sessions/{sessionId}")
    fun getSession(authentication: Authentication, @PathVariable sessionId: String): SwipeSessionDetailResponse =
        swipeService.getSession(authentication.userId(), sessionId)

    @PostMapping("/swipe/sessions/{sessionId}/results")
    fun submitResults(
        authentication: Authentication,
        @PathVariable sessionId: String,
        @Valid @RequestBody request: SwipeResultRequest,
    ): ResponseEntity<Unit> {
        swipeService.submitResults(authentication.userId(), sessionId, request)
        return ResponseEntity.noContent().build()
    }
}

private fun Authentication.userId(): Long = principal as Long
