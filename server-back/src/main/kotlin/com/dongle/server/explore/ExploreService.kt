package com.dongle.server.explore

import com.dongle.server.explore.dto.SimilarLogItemResponse
import com.dongle.server.explore.dto.SimilarLogsResponse
import com.dongle.server.user.UserPreferenceRepository
import com.dongle.server.visitlog.VisitLog
import com.dongle.server.visitlog.VisitLogRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional(readOnly = true)
class ExploreService(
    private val userPreferenceRepository: UserPreferenceRepository,
    private val visitLogRepository: VisitLogRepository,
) {
    fun similarLogs(
        userId: Long,
        swLat: Double?,
        swLng: Double?,
        neLat: Double?,
        neLng: Double?,
        limit: Int,
    ): SimilarLogsResponse {
        val myTopTags = userPreferenceRepository.findByUserId(userId)
            .sortedByDescending { it.score }
            .take(TOP_TAG_COUNT)
            .map { it.tag }
        if (myTopTags.isEmpty()) return SimilarLogsResponse(logs = emptyList())

        val similarUserIds = userPreferenceRepository.findSimilarUserIds(myTopTags, SIMILARITY_THRESHOLD, userId)
        if (similarUserIds.isEmpty()) return SimilarLogsResponse(logs = emptyList())

        val candidates = visitLogRepository.findPublicByUserIds(
            similarUserIds,
            PageRequest.of(0, limit * BOUNDS_FETCH_MULTIPLIER),
        )

        val withinBounds = if (swLat != null && swLng != null && neLat != null && neLng != null) {
            candidates.filter { log ->
                val lat = log.place.lat
                val lng = log.place.lng
                lat != null && lng != null && lat in swLat..neLat && lng in swLng..neLng
            }
        } else {
            candidates
        }

        return SimilarLogsResponse(logs = withinBounds.take(limit).map { it.toSimilarLogItemResponse() })
    }

    companion object {
        private const val TOP_TAG_COUNT = 3

        // 0.5가 중립 기준선(ssot.md)이므로, 그보다 뚜렷하게 높은 태그만 "취향 겹침"으로 인정
        private const val SIMILARITY_THRESHOLD = 0.6
        private const val BOUNDS_FETCH_MULTIPLIER = 3
    }
}

private fun VisitLog.toSimilarLogItemResponse() = SimilarLogItemResponse(
    logId = id,
    placeId = place.id,
    placeName = place.name,
    lat = place.lat,
    lng = place.lng,
    photoUrl = photoUrl,
    oneLine = oneLine,
    tags = emotionTags.map { it.tag },
)
