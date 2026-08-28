package com.dongle.server.visitlog

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface VisitLogRepository : JpaRepository<VisitLog, Long> {

    fun findByUserId(userId: Long, pageable: Pageable): Page<VisitLog>

    fun findByPlaceId(placeId: Long, pageable: Pageable): Page<VisitLog>

    @Query("select vl from VisitLog vl where vl.user.id in :userIds and vl.isPublic = true order by vl.visitedAt desc")
    fun findPublicByUserIds(@Param("userIds") userIds: Collection<Long>, pageable: Pageable): List<VisitLog>
}
