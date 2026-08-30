package com.dongle.server.swipe

import org.springframework.data.jpa.repository.JpaRepository

interface SwipeSessionCandidateRepository : JpaRepository<SwipeSessionCandidate, Long> {

    fun findBySessionIdOrderBySortOrder(sessionId: String): List<SwipeSessionCandidate>
}
