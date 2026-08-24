package com.dongle.server.place

import org.springframework.data.jpa.repository.JpaRepository

interface PlaceSemanticVectorRepository : JpaRepository<PlaceSemanticVector, Long> {

    fun findByPlaceIdIn(placeIds: Collection<Long>): List<PlaceSemanticVector>
}
