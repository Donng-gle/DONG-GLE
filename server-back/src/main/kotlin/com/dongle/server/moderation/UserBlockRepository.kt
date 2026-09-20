package com.dongle.server.moderation

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface UserBlockRepository : JpaRepository<UserBlock, Long> {

    fun existsByBlockerIdAndBlockedId(blockerId: Long, blockedId: Long): Boolean

    fun findByBlockerIdAndBlockedId(blockerId: Long, blockedId: Long): UserBlock?

    fun findByBlockerIdOrderByCreatedAtDesc(blockerId: Long): List<UserBlock>

    // ExploreService/VisitLogService가 후보 목록에서 걸러낼 때 씀 — 엔티티 안 거치고 id만 조회
    @Query("select ub.blocked.id from UserBlock ub where ub.blocker.id = :blockerId")
    fun findBlockedUserIds(@Param("blockerId") blockerId: Long): Set<Long>
}
