package com.dongle.server.place

import org.springframework.data.jpa.repository.JpaRepository

interface PlaceEmotionTagRepository : JpaRepository<PlaceEmotionTag, Long> {

    fun findByPlaceIdAndTag(placeId: Long, tag: String): PlaceEmotionTag?
}
