package com.dongle.server.course

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface CourseRepository : JpaRepository<Course, Long> {

    fun findByUserId(userId: Long, pageable: Pageable): Page<Course>

    // "취향 맞춤 코스" 탭 — 취향 겹치는 유저들의 공개 코스 탐색(2026-09-07 결정, decision-log 참고).
    // VisitLogRepository.findPublicByUserIds와 동일한 패턴
    @Query("select c from Course c where c.user.id in :userIds and c.isPublic = true order by c.createdAt desc")
    fun findPublicByUserIds(@Param("userIds") userIds: Collection<Long>, pageable: Pageable): List<Course>
}
