package com.dongle.server.place

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDate

interface PlaceRepository : JpaRepository<Place, Long> {

    fun findByCategory(category: PlaceCategory, pageable: Pageable): Page<Place>

    @Query(
        """
        select p from Place p
        where p.category = :category
          and p.eventStartDate <= :travelDate
          and p.eventEndDate >= :travelDate
        """
    )
    fun findByCategoryAndTravelDate(
        @Param("category") category: PlaceCategory,
        @Param("travelDate") travelDate: LocalDate,
        pageable: Pageable,
    ): Page<Place>
}
