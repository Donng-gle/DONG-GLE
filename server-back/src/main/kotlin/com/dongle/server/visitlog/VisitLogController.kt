package com.dongle.server.visitlog

import com.dongle.server.visitlog.dto.MyLogsResponse
import com.dongle.server.visitlog.dto.PlaceLogsResponse
import com.dongle.server.visitlog.dto.VisitLogDetailResponse
import com.dongle.server.visitlog.dto.VisitLogUpdateRequest
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
class VisitLogController(
    private val visitLogService: VisitLogService,
) {
    @GetMapping("/users/me/logs")
    fun myLogs(
        authentication: Authentication,
        @RequestParam(defaultValue = "1") page: Int,
        @RequestParam(defaultValue = "50") size: Int,
    ): MyLogsResponse = visitLogService.myLogs(authentication.userId(), page, size)

    @GetMapping("/places/{placeId}/logs")
    fun logsForPlace(
        @PathVariable placeId: Long,
        @RequestParam(defaultValue = "1") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): PlaceLogsResponse = visitLogService.logsForPlace(placeId, page, size)

    @GetMapping("/logs/{logId}")
    fun getDetail(authentication: Authentication, @PathVariable logId: Long): VisitLogDetailResponse =
        visitLogService.getDetail(authentication.userId(), logId)

    @PatchMapping("/logs/{logId}")
    fun update(
        authentication: Authentication,
        @PathVariable logId: Long,
        @Valid @RequestBody request: VisitLogUpdateRequest,
    ): VisitLogDetailResponse = visitLogService.update(authentication.userId(), logId, request)

    @DeleteMapping("/logs/{logId}")
    fun delete(authentication: Authentication, @PathVariable logId: Long): ResponseEntity<Unit> {
        visitLogService.delete(authentication.userId(), logId)
        return ResponseEntity.noContent().build()
    }
}

private fun Authentication.userId(): Long = principal as Long
