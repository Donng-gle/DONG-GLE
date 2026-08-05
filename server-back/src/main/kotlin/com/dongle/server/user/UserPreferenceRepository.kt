package com.dongle.server.user

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface UserPreferenceRepository : JpaRepository<UserPreference, Long> {

    fun findByUserId(userId: Long): List<UserPreference>

    fun findByUserIdAndTag(userId: Long, tag: String): UserPreference?

    fun deleteAllByUserId(userId: Long)

    // 내 상위 태그를 강하게(threshold 이상) 가진 다른 유저 = "유사 취향" 유저로 취급
    @Query(
        """
        select distinct up.user.id from UserPreference up
        where up.tag in :tags and up.score >= :threshold and up.user.id <> :excludeUserId
        """
    )
    fun findSimilarUserIds(
        @Param("tags") tags: Collection<String>,
        @Param("threshold") threshold: Double,
        @Param("excludeUserId") excludeUserId: Long,
    ): List<Long>
}
