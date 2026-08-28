package com.dongle.server.place

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface PlaceHoursRepository : JpaRepository<PlaceHours, Long> {

    @Query(
        """
        select h from PlaceHours h
        where h.place.id in :placeIds
        order by h.place.id asc, h.openDay asc, h.openTime asc
        """
    )
    fun findByPlaceIdIn(@Param("placeIds") placeIds: List<Long>): List<PlaceHours>
}
