package com.dongle.server.place

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface PlaceLikeRepository : JpaRepository<PlaceLike, Long> {

    fun existsByUserIdAndPlaceId(userId: Long, placeId: Long): Boolean

    fun findByUserIdAndPlaceId(userId: Long, placeId: Long): PlaceLike?

    @Query("select pl.place.id from PlaceLike pl where pl.user.id = :userId and pl.place.id in :placeIds")
    fun findLikedPlaceIds(@Param("userId") userId: Long, @Param("placeIds") placeIds: Collection<Long>): Set<Long>

    fun countByPlaceId(placeId: Long): Long
}
