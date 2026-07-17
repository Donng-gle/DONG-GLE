package com.dongle.server.place

import com.dongle.server.place.dto.PlaceDetailResponse
import com.dongle.server.place.dto.PlacesResponse
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

@RestController
@RequestMapping("/places")
class PlaceController(
    private val placeService: PlaceService,
) {
    @GetMapping
    fun listPlaces(
        @RequestParam(required = false) category: PlaceCategory?,
        @RequestParam(name = "travel_date", required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        travelDate: LocalDate?,
        @RequestParam(defaultValue = "1") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): PlacesResponse = placeService.listPlaces(category, travelDate, page, size)

    @GetMapping("/{placeId}")
    fun getPlaceDetail(@PathVariable placeId: Long): PlaceDetailResponse =
        placeService.getPlaceDetail(placeId)
}
