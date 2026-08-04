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

    @Query(
        """
        select p from Place p
        where p.lat between :swLat and :neLat
          and p.lng between :swLng and :neLng
        """
    )
    fun findWithinBounds(
        @Param("swLat") swLat: Double,
        @Param("swLng") swLng: Double,
        @Param("neLat") neLat: Double,
        @Param("neLng") neLng: Double,
    ): List<Place>

    @Query(
        """
        select p from Place p
        where p.lat between :swLat and :neLat
          and p.lng between :swLng and :neLng
          and p.category = :category
        """
    )
    fun findWithinBoundsAndCategory(
        @Param("swLat") swLat: Double,
        @Param("swLng") swLng: Double,
        @Param("neLat") neLat: Double,
        @Param("neLng") neLng: Double,
        @Param("category") category: PlaceCategory,
    ): List<Place>

    @Query(
        """
        select p from Place p
        where lower(p.name) like lower(concat('%', :keyword, '%'))
           or lower(p.addr1) like lower(concat('%', :keyword, '%'))
        """
    )
    fun search(@Param("keyword") keyword: String, pageable: Pageable): Page<Place>

    @Query("select pl.place from PlaceLike pl where pl.user.id = :userId order by pl.createdAt desc")
    fun findLikedPlaces(@Param("userId") userId: Long, pageable: Pageable): Page<Place>

    @Query(
        """
        select p from Place p
        where p.category = :category
          and p.eventEndDate >= :monthStart
          and p.eventStartDate <= :monthEnd
        order by p.eventStartDate asc
        """
    )
    fun findEventsInMonth(
        @Param("category") category: PlaceCategory,
        @Param("monthStart") monthStart: LocalDate,
        @Param("monthEnd") monthEnd: LocalDate,
        pageable: Pageable,
    ): Page<Place>
}
