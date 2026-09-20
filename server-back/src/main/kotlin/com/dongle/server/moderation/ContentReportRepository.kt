package com.dongle.server.moderation

import org.springframework.data.jpa.repository.JpaRepository

interface ContentReportRepository : JpaRepository<ContentReport, Long> {

    fun findByStatusOrderByCreatedAtAsc(status: ReportStatus): List<ContentReport>
}
