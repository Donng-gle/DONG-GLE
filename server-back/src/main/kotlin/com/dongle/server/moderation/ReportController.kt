package com.dongle.server.moderation

import com.dongle.server.moderation.dto.CreateReportRequest
import com.dongle.server.moderation.dto.ReportResponse
import com.dongle.server.moderation.dto.ReportsResponse
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

// 앱스토어 심사 가이드라인 1.2(User Generated Content) 대응 — 콘텐츠 신고(2026-09-14 도입)
@RestController
@RequestMapping("/reports")
class ReportController(
    private val reportService: ReportService,
) {
    @PostMapping
    fun create(authentication: Authentication, @Valid @RequestBody request: CreateReportRequest): ResponseEntity<ReportResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(reportService.create(authentication.userId(), request))

    // 운영자(팀원)가 미확인 신고를 확인하는 용도 — 별도 role 체계가 없어 로그인만 요구(2026-09-14)
    @GetMapping
    fun listPending(): ReportsResponse = ReportsResponse(reports = reportService.listPending())
}

private fun Authentication.userId(): Long = principal as Long
