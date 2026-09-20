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

    // 취향 겹치는 유저가 아직 없거나(초기 가입 직후 등) 그런 유저가 공개 코스를 하나도 안 남겼을 때의
    // 콜드 스타트 대비 — ExploreService가 이 결과를 작성자 기준으로 걸러서 씀(2026-09-15 추가)
    @Query("select c from Course c where c.isPublic = true order by c.createdAt desc")
    fun findPublicRecent(pageable: Pageable): List<Course>
}
