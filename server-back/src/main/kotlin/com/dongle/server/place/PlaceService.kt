package com.dongle.server.place

import com.dongle.server.common.PaginationMeta
import com.dongle.server.place.dto.FeaturedPlacesResponse
import com.dongle.server.place.dto.PlaceDetailResponse
import com.dongle.server.place.dto.PlaceHoursResponse
import com.dongle.server.place.dto.PlaceImageResponse
import com.dongle.server.place.dto.PlaceListItemResponse
import com.dongle.server.place.dto.PlaceMapPinResponse
import com.dongle.server.place.dto.PlaceMapResponse
import com.dongle.server.place.dto.PlacesResponse
import com.dongle.server.user.UserPreferenceRepository
import com.dongle.server.visitlog.LogEmotionTagRepository
import com.dongle.server.visitlog.PlaceTagCount
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
    private val placeHoursRepository: PlaceHoursRepository,
    private val userPreferenceRepository: UserPreferenceRepository,
    private val logEmotionTagRepository: LogEmotionTagRepository,
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
        val hours = placeHoursRepository.findByPlaceIdIn(listOf(placeId))
        return place.toDetailResponse(isLiked, vector, hours)
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
        val myTopTags = userId?.let { topPreferenceTags(it) } ?: emptyList()
        return if (myTopTags.isNotEmpty()) {
            personalizedFeatured(userId!!, myTopTags, limit) ?: popularFeatured(limit, userId)
        } else {
            popularFeatured(limit, userId)
        }
    }

    private fun topPreferenceTags(userId: Long): List<String> =
        userPreferenceRepository.findByUserId(userId)
            .sortedByDescending { it.score }
            .take(TAG_DISPLAY_LIMIT)
            .map { it.tag }

    // user_preference 상위 태그와 장소의 상위 태그(누적 방문 로그 우선, 없으면 semantic_vector 대체 —
    // resolveTags와 동일한 폴백 규칙) 겹침 개수로 정렬. 겹치는 장소가 하나도 없으면 개인화 의미가 없으므로
    // null을 반환해 인기순으로 폴백한다 (is_personalized를 잘못 true로 표시하지 않기 위함)
    private fun personalizedFeatured(userId: Long, myTopTags: List<String>, limit: Int): FeaturedPlacesResponse? {
        val allPlaces = placeRepository.findAll()
        val vectors = semanticVectorsByPlaceId(allPlaces.map { it.id })

        val ranked = allPlaces
            .map { place -> place to place.resolveTags(vectors[place.id], TAG_DISPLAY_LIMIT).count { it in myTopTags } }
            .sortedWith(compareByDescending<Pair<Place, Int>> { it.second }.thenByDescending { it.first.visitLogCount })

        if (ranked.firstOrNull()?.second == 0) return null

        val places = ranked.take(limit).map { it.first }
        val likedIds = likedPlaceIds(userId, places.map { it.id })

        return FeaturedPlacesResponse(
            places = places.map { it.toListItemResponse(likedIds, vectors[it.id]) },
            isPersonalized = true,
        )
    }

    private fun popularFeatured(limit: Int, userId: Long?): FeaturedPlacesResponse {
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

    // SwipeService(스와이프 후보 카드) 등 다른 서비스도 동일한 place_semantic_vector 조회가 필요해 공개
    fun semanticVectorsByPlaceId(placeIds: List<Long>): Map<Long, PlaceSemanticVector> =
        if (placeIds.isEmpty()) emptyMap()
        else placeSemanticVectorRepository.findByPlaceIdIn(placeIds).associateBy { it.placeId }

    // SwipeCandidate.tags 등 place_semantic_vector/place_emotion_tag를 직접 다루지 않는 다른 서비스가
    // 동일한 태그 노출 규칙을 재사용할 수 있도록 공개 래퍼로 노출
    fun displayTags(place: Place, vector: PlaceSemanticVector?): List<String> = place.resolveTags(vector, TAG_DISPLAY_LIMIT)

    // 방문 로그 누적 감성 태그(log_emotion_tag)에 데이터가 있으면 그걸 우선 사용하고,
    // 없으면 place_semantic_vector(AI 사전 분석, major_scores)의 상위 태그로 대체한다.
    // 예전엔 place_emotion_tag(place_id, tag, count) 테이블을 따로 두고 증감시켰는데,
    // AI가 log_emotion_tag에 직접 배치로 적재하면서 그 카운트 동기화를 누가 책임질지 애매해짐 —
    // 아예 저장을 없애고 조회 시점에 log_emotion_tag를 직접 집계하는 방식으로 전환
    // (2026-09-02 결정, decision-log 참고). 두 신호(누적 방문 태그 vs AI 사전 분석)를 어떻게
    // 함께 쓸지 정식 설계는 여전히 필요 (milestone.md 참고)
    private fun Place.resolveTags(vector: PlaceSemanticVector?, limit: Int): List<String> {
        val fromVisitLogs = logEmotionTagRepository.countTagsByPlaceId(id).map { it.tag }
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

    private fun Place.toDetailResponse(isLiked: Boolean?, vector: PlaceSemanticVector?, hours: List<PlaceHours>) = PlaceDetailResponse(
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
        hours = hours.map { h -> PlaceHoursResponse(h.openDay, h.openTime, h.closeDay, h.closeTime) },
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
