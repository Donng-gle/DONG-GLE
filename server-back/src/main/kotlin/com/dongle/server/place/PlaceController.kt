package com.dongle.server.place

import com.dongle.server.place.dto.FeaturedPlacesResponse
import com.dongle.server.place.dto.LikeResponse
import com.dongle.server.place.dto.PlaceDetailResponse
import com.dongle.server.place.dto.PlaceMapResponse
import com.dongle.server.place.dto.PlacesResponse
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

@RestController
@RequestMapping("/places")
class PlaceController(
    private val placeService: PlaceService,
    private val likeService: LikeService,
) {
    @GetMapping
    fun listPlaces(
        @RequestParam(required = false) category: PlaceCategory?,
        @RequestParam(name = "travel_date", required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        travelDate: LocalDate?,
        @RequestParam(defaultValue = "1") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        authentication: Authentication?,
    ): PlacesResponse = placeService.listPlaces(category, travelDate, page, size, authentication.currentUserId())

    @GetMapping("/map")
    fun getMapPins(
        @RequestParam bounds: String,
        @RequestParam(required = false) category: PlaceCategory?,
        @RequestParam(name = "travel_date", required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        travelDate: LocalDate?,
        authentication: Authentication?,
    ): PlaceMapResponse {
        val (swLat, swLng, neLat, neLng) = bounds.split(",").map { it.trim().toDouble() }
        return placeService.getMapPins(swLat, swLng, neLat, neLng, category, travelDate, authentication.currentUserId())
    }

    @GetMapping("/featured")
    fun featured(
        @RequestParam(defaultValue = "10") limit: Int,
        authentication: Authentication?,
    ): FeaturedPlacesResponse = placeService.featured(limit, authentication.currentUserId())

    @GetMapping("/search")
    fun search(
        @RequestParam q: String,
        @RequestParam(defaultValue = "1") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        authentication: Authentication?,
    ): PlacesResponse = placeService.search(q, page, size, authentication.currentUserId())

    @GetMapping("/{placeId}")
    fun getPlaceDetail(@PathVariable placeId: Long, authentication: Authentication?): PlaceDetailResponse =
        placeService.getPlaceDetail(placeId, authentication.currentUserId())

    @PostMapping("/{placeId}/like")
    fun like(@PathVariable placeId: Long, authentication: Authentication): LikeResponse {
        likeService.like(authentication.requireUserId(), placeId)
        return LikeResponse(isLiked = true)
    }

    @DeleteMapping("/{placeId}/like")
    fun unlike(@PathVariable placeId: Long, authentication: Authentication): LikeResponse {
        likeService.unlike(authentication.requireUserId(), placeId)
        return LikeResponse(isLiked = false)
    }
}

private fun Authentication?.currentUserId(): Long? = this?.principal as? Long

private fun Authentication.requireUserId(): Long = principal as Long
