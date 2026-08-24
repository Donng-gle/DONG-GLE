package com.dongle.server.place

import com.dongle.server.common.PaginationMeta
import com.dongle.server.place.dto.FeaturedPlacesResponse
import com.dongle.server.place.dto.PlaceDetailResponse
import com.dongle.server.place.dto.PlaceImageResponse
import com.dongle.server.place.dto.PlaceListItemResponse
import com.dongle.server.place.dto.PlaceMapPinResponse
import com.dongle.server.place.dto.PlaceMapResponse
import com.dongle.server.place.dto.PlacesResponse
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper
import java.time.LocalDate

@Service
@Transactional(readOnly = true)
class PlaceService(
    private val placeRepository: PlaceRepository,
    private val placeLikeRepository: PlaceLikeRepository,
    private val placeSemanticVectorRepository: PlaceSemanticVectorRepository,
    private val objectMapper: ObjectMapper,
) {
    fun listPlaces(category: PlaceCategory?, travelDate: LocalDate?, page: Int, size: Int, userId: Long?): PlacesResponse {
        val pageable = PageRequest.of((page - 1).coerceAtLeast(0), size)

        val result: Page<Place> = when {
            category != null && travelDate != null ->
                placeRepository.findByCategoryAndTravelDate(category, travelDate, pageable)
            category != null -> placeRepository.findByCategory(category, pageable)
            else -> placeRepository.findAll(pageable)
        }

        val likedIds = likedPlaceIds(userId, result.content.map { it.id })
        val vectors = semanticVectorsByPlaceId(result.content.map { it.id })

        return PlacesResponse(
            places = result.content.map { it.toListItemResponse(likedIds, vectors[it.id]) },
            meta = PaginationMeta(
                total = result.totalElements,
                page = page,
                size = size,
                hasNext = result.hasNext(),
            ),
        )
    }

    fun getPlaceDetail(placeId: Long, userId: Long?): PlaceDetailResponse {
        val place = placeRepository.findById(placeId)
            .orElseThrow { PlaceNotFoundException(placeId) }
        val isLiked = userId?.let { placeLikeRepository.existsByUserIdAndPlaceId(it, placeId) }
        val vector = placeSemanticVectorRepository.findById(placeId).orElse(null)
        return place.toDetailResponse(isLiked, vector)
    }

    fun getMapPins(
        swLat: Double,
        swLng: Double,
        neLat: Double,
        neLng: Double,
        category: PlaceCategory?,
        travelDate: LocalDate?,
        userId: Long?,
    ): PlaceMapResponse {
        val places = (
            if (category != null) placeRepository.findWithinBoundsAndCategory(swLat, swLng, neLat, neLng, category)
            else placeRepository.findWithinBounds(swLat, swLng, neLat, neLng)
            ).filter { travelDate == null || it.isOngoingOn(travelDate) }

        val likedIds = likedPlaceIds(userId, places.map { it.id })
        val vectors = semanticVectorsByPlaceId(places.map { it.id })

        return PlaceMapResponse(
            pins = places.map { it.toMapPinResponse(likedIds, vectors[it.id]) },
            total = places.size,
        )
    }

    fun search(keyword: String, page: Int, size: Int, userId: Long?): PlacesResponse {
        val pageable = PageRequest.of((page - 1).coerceAtLeast(0), size)
        val result = placeRepository.search(keyword, pageable)
        val likedIds = likedPlaceIds(userId, result.content.map { it.id })
        val vectors = semanticVectorsByPlaceId(result.content.map { it.id })

        return PlacesResponse(
            places = result.content.map { it.toListItemResponse(likedIds, vectors[it.id]) },
            meta = PaginationMeta(
                total = result.totalElements,
                page = page,
                size = size,
                hasNext = result.hasNext(),
            ),
        )
    }

    fun featured(limit: Int, userId: Long?): FeaturedPlacesResponse {
        // TODO: 온보딩/user_preference 구현 후 인증 유저 개인화 추천으로 교체. 현재는 인기순(visit_log_count) 고정
        val pageable = PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, "visitLogCount"))
        val places = placeRepository.findAll(pageable).content
        val likedIds = likedPlaceIds(userId, places.map { it.id })
        val vectors = semanticVectorsByPlaceId(places.map { it.id })

        return FeaturedPlacesResponse(
            places = places.map { it.toListItemResponse(likedIds, vectors[it.id]) },
            isPersonalized = false,
        )
    }

    fun myLikedPlaces(userId: Long, page: Int, size: Int): PlacesResponse {
        val pageable = PageRequest.of((page - 1).coerceAtLeast(0), size)
        val result = placeRepository.findLikedPlaces(userId, pageable)
        val vectors = semanticVectorsByPlaceId(result.content.map { it.id })

        return PlacesResponse(
            places = result.content.map { it.toListItemResponse(setOf(it.id), vectors[it.id]) },
            meta = PaginationMeta(
                total = result.totalElements,
                page = page,
                size = size,
                hasNext = result.hasNext(),
            ),
        )
    }

    private fun likedPlaceIds(userId: Long?, placeIds: List<Long>): Set<Long> =
        if (userId == null || placeIds.isEmpty()) emptySet()
        else placeLikeRepository.findLikedPlaceIds(userId, placeIds)

    private fun semanticVectorsByPlaceId(placeIds: List<Long>): Map<Long, PlaceSemanticVector> =
        if (placeIds.isEmpty()) emptyMap()
        else placeSemanticVectorRepository.findByPlaceIdIn(placeIds).associateBy { it.placeId }

    // place_emotion_tag(방문 로그 누적)에 데이터가 있으면 그걸 우선 사용하고,
    // 없으면 place_semantic_vector(AI 사전 분석, major_scores)의 상위 태그로 대체한다.
    // 2026-08-21 아키텍처 전환으로 place_emotion_tag가 당분간 전부 비어있는 임시 조치 —
    // 두 신호를 어떻게 함께 쓸지 정식 설계 나오면 교체 필요 (milestone.md 참고)
    private fun Place.resolveTags(vector: PlaceSemanticVector?, limit: Int): List<String> {
        val fromVisitLogs = emotionTags.sortedByDescending { it.count }.map { it.tag }
        if (fromVisitLogs.isNotEmpty()) return fromVisitLogs.take(limit)
        return vector?.let { topTagsFromMajorScores(it.majorScores, limit) } ?: emptyList()
    }

    private fun topTagsFromMajorScores(majorScoresJson: String, limit: Int): List<String> =
        try {
            val node = objectMapper.readTree(majorScoresJson)
            MAJOR_TAG_KEYS.mapNotNull { key -> node.get(key)?.let { key to it.asDouble() } }
                .sortedByDescending { it.second }
                .take(limit)
                .map { it.first }
        } catch (e: Exception) {
            emptyList()
        }

    private fun Place.toListItemResponse(likedIds: Set<Long>, vector: PlaceSemanticVector?) = PlaceListItemResponse(
        id = id,
        name = name,
        category = category.name,
        mainImageUrl = mainImageUrl,
        addr1 = addr1,
        lat = lat,
        lng = lng,
        tags = resolveTags(vector, TAG_DISPLAY_LIMIT),
        isLiked = likedIds.contains(id),
    )

    private fun Place.toDetailResponse(isLiked: Boolean?, vector: PlaceSemanticVector?) = PlaceDetailResponse(
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
        topTags = resolveTags(vector, MAJOR_TAG_KEYS.size),
        visitLogCount = visitLogCount,
        isLiked = isLiked,
    )

    private fun Place.toMapPinResponse(likedIds: Set<Long>, vector: PlaceSemanticVector?) = PlaceMapPinResponse(
        id = id,
        name = name,
        category = category.name,
        lat = lat,
        lng = lng,
        mainImageUrl = mainImageUrl,
        tags = resolveTags(vector, TAG_DISPLAY_LIMIT),
        isLiked = likedIds.contains(id),
    )

    companion object {
        private const val TAG_DISPLAY_LIMIT = 3
        private val MAJOR_TAG_KEYS =
            listOf("relaxing", "lively", "romantic", "local", "photogenic", "traditional", "modern")
    }
}

private fun Place.isOngoingOn(date: LocalDate): Boolean {
    val start = eventStartDate ?: return true
    val end = eventEndDate ?: return true
    return !date.isBefore(start) && !date.isAfter(end)
}
