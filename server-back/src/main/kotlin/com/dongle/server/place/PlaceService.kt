package com.dongle.server.place

import com.dongle.server.common.PaginationMeta
import com.dongle.server.place.dto.PlaceDetailResponse
import com.dongle.server.place.dto.PlaceImageResponse
import com.dongle.server.place.dto.PlaceListItemResponse
import com.dongle.server.place.dto.PlacesResponse
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate

@Service
@Transactional(readOnly = true)
class PlaceService(
    private val placeRepository: PlaceRepository,
) {
    fun listPlaces(category: PlaceCategory?, travelDate: LocalDate?, page: Int, size: Int): PlacesResponse {
        val pageable = PageRequest.of((page - 1).coerceAtLeast(0), size)

        val result: Page<Place> = when {
            category != null && travelDate != null ->
                placeRepository.findByCategoryAndTravelDate(category, travelDate, pageable)
            category != null -> placeRepository.findByCategory(category, pageable)
            else -> placeRepository.findAll(pageable)
        }

        return PlacesResponse(
            places = result.content.map { it.toListItemResponse() },
            meta = PaginationMeta(
                total = result.totalElements,
                page = page,
                size = size,
                hasNext = result.hasNext(),
            ),
        )
    }

    fun getPlaceDetail(placeId: Long): PlaceDetailResponse {
        val place = placeRepository.findById(placeId)
            .orElseThrow { PlaceNotFoundException(placeId) }
        return place.toDetailResponse()
    }
}

private fun Place.toListItemResponse() = PlaceListItemResponse(
    id = id,
    name = name,
    category = category.name,
    mainImageUrl = mainImageUrl,
    addr1 = addr1,
    lat = lat,
    lng = lng,
    tags = emotionTags.sortedByDescending { it.count }.take(3).map { it.tag },
    isLiked = false,
)

private fun Place.toDetailResponse() = PlaceDetailResponse(
    id = id,
    contentId = contentId,
    name = name,
    category = category.name,
    addr1 = addr1,
    addr2 = addr2,
    lat = lat,
    lng = lng,
    tel = tel,
    mainImageUrl = mainImageUrl,
    overview = overview,
    homepage = homepage,
    eventStartDate = eventStartDate,
    eventEndDate = eventEndDate,
    images = images.map { PlaceImageResponse(it.id, it.imgUrl, it.sortOrder) },
    topTags = emotionTags.sortedByDescending { it.count }.map { it.tag },
    visitLogCount = visitLogCount,
    isLiked = null,
)
