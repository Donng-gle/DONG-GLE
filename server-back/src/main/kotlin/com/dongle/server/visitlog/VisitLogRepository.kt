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

    // CourseRepository.findPublicRecent와 동일한 목적(콜드 스타트 fallback, 2026-09-15 추가)
    @Query("select vl from VisitLog vl where vl.isPublic = true order by vl.visitedAt desc")
    fun findPublicRecent(pageable: Pageable): List<VisitLog>

    // rating은 선택 입력이라(null 허용) AVG는 자동으로 null을 제외하고 계산함 — 기록이 없거나
    // 아무도 별점을 안 남겼으면 null 반환(PlaceService에서 그대로 avgRating=null로 노출)
    @Query("select avg(vl.rating) from VisitLog vl where vl.place.id = :placeId and vl.rating is not null")
    fun findAverageRatingByPlaceId(@Param("placeId") placeId: Long): Double?
}
