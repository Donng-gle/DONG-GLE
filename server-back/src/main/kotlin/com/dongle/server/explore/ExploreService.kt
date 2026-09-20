package com.dongle.server.explore

import com.dongle.server.course.Course
import com.dongle.server.course.CourseRepository
import com.dongle.server.explore.dto.SimilarCourseItemResponse
import com.dongle.server.explore.dto.SimilarCoursePlacePreview
import com.dongle.server.explore.dto.SimilarCoursesResponse
import com.dongle.server.explore.dto.SimilarLogItemResponse
import com.dongle.server.explore.dto.SimilarLogsResponse
import com.dongle.server.moderation.UserBlockRepository
import com.dongle.server.user.UserPreferenceRepository
import com.dongle.server.visitlog.VisitLog
import com.dongle.server.visitlog.VisitLogPhoto
import com.dongle.server.visitlog.VisitLogRepository
import com.dongle.server.visitlog.dto.VisitLogPhotoResponse
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional(readOnly = true)
class ExploreService(
    private val userPreferenceRepository: UserPreferenceRepository,
    private val visitLogRepository: VisitLogRepository,
    private val courseRepository: CourseRepository,
    private val userBlockRepository: UserBlockRepository,
) {
    fun similarLogs(
        userId: Long,
        swLat: Double?,
        swLng: Double?,
        neLat: Double?,
        neLng: Double?,
        limit: Int,
    ): SimilarLogsResponse {
        // 앱스토어 심사 가이드라인 1.2 대응(2026-09-14) — 차단한 유저는 후보군에서 아예 제외
        val blockedUserIds = userBlockRepository.findBlockedUserIds(userId)
        val similarUserIds = resolveSimilarUserIds(userId, blockedUserIds)

        val candidates = if (similarUserIds != null) {
            visitLogRepository.findPublicByUserIds(similarUserIds, PageRequest.of(0, limit * BOUNDS_FETCH_MULTIPLIER))
        } else {
            emptyList()
        }

        var result = filterWithinBounds(candidates, swLat, swLng, neLat, neLng).take(limit)

        // 취향 겹치는 유저가 아직 없거나(가입 초기) 그 유저들이 공개 기록을 하나도 안 남겼을 때의
        // 콜드 스타트 대비 — 빈 추천 탭보다는 최신 공개 기록이라도 보여주는 게 낫다는 판단
        // (2026-09-15 결정, decision-log 참고)
        if (result.isEmpty()) {
            val fallbackCandidates = visitLogRepository
                .findPublicRecent(PageRequest.of(0, limit * BOUNDS_FETCH_MULTIPLIER))
                .filter { it.user.id != userId && it.user.id !in blockedUserIds }
            result = filterWithinBounds(fallbackCandidates, swLat, swLng, neLat, neLng).take(limit)
        }

        return SimilarLogsResponse(logs = result.map { it.toSimilarLogItemResponse() })
    }

    private fun filterWithinBounds(
        logs: List<VisitLog>,
        swLat: Double?,
        swLng: Double?,
        neLat: Double?,
        neLng: Double?,
    ): List<VisitLog> {
        if (swLat == null || swLng == null || neLat == null || neLng == null) return logs
        return logs.filter { log ->
            val lat = log.place.lat
            val lng = log.place.lng
            lat != null && lng != null && lat in swLat..neLat && lng in swLng..neLng
        }
    }

    // "취향 맞춤 코스" 탭 — 취향 겹치는 유저의 공개 코스 탐색(2026-09-07 결정, decision-log 참고).
    // similarLogs와 동일한 취향 겹침 판단(상위 태그 3개, 유사도 0.6 이상)을 그대로 재사용
    fun similarCourses(userId: Long, limit: Int): SimilarCoursesResponse {
        val blockedUserIds = userBlockRepository.findBlockedUserIds(userId)
        val similarUserIds = resolveSimilarUserIds(userId, blockedUserIds)

        val candidates = if (similarUserIds != null) {
            courseRepository.findPublicByUserIds(similarUserIds, PageRequest.of(0, limit))
        } else {
            emptyList()
        }

        // similarLogs와 동일한 콜드 스타트 fallback(2026-09-15 결정, decision-log 참고)
        val result = candidates.ifEmpty {
            courseRepository.findPublicRecent(PageRequest.of(0, limit * BOUNDS_FETCH_MULTIPLIER))
                .filter { it.user.id != userId && it.user.id !in blockedUserIds }
                .take(limit)
        }

        return SimilarCoursesResponse(courses = result.map { it.toSimilarCourseItemResponse() })
    }

    private fun resolveSimilarUserIds(userId: Long, blockedUserIds: Set<Long>): List<Long>? {
        val myTopTags = userPreferenceRepository.findByUserId(userId)
            .sortedByDescending { it.score }
            .take(TOP_TAG_COUNT)
            .map { it.tag }
        if (myTopTags.isEmpty()) return null

        val similarUserIds = userPreferenceRepository.findSimilarUserIds(myTopTags, SIMILARITY_THRESHOLD, userId)
            .filterNot { it in blockedUserIds }
        return similarUserIds.ifEmpty { null }
    }

    companion object {
        private const val TOP_TAG_COUNT = 3

        // 0.5가 중립 기준선(ssot.md)이므로, 그보다 뚜렷하게 높은 태그만 "취향 겹침"으로 인정
        private const val SIMILARITY_THRESHOLD = 0.6
        private const val BOUNDS_FETCH_MULTIPLIER = 3

        // 카드 사진 캐러셀 장수 상한 — CourseService.SCRAPBOOK_THUMBNAIL_LIMIT(3)과 동일 기준.
        // 아래 top-level 확장 함수(Course.toSimilarCourseItemResponse)에서 참조해야 해서 private 아님
        const val PLACE_PREVIEW_LIMIT = 3
    }
}

private fun VisitLog.toSimilarLogItemResponse() = SimilarLogItemResponse(
    logId = id,
    placeId = place.id,
    placeName = place.name,
    lat = place.lat,
    lng = place.lng,
    // 여러 장 사진 확장은 처음엔 범위 밖이었는데(2026-09-06 결정), 이번에 카드 사진 캐러셀+캡션
    // 지원으로 다시 확장(2026-09-07 결정, decision-log 참고)
    photos = photos.map { it.toResponse() },
    oneLine = oneLine,
    rating = rating,
    tags = emotionTags.map { it.tag },
    nickname = user.nickname,
    profileImageUrl = user.profileImageUrl,
    authorUserId = user.id,
)

private fun VisitLogPhoto.toResponse() = VisitLogPhotoResponse(url = photoUrl, caption = caption)

private fun Course.toSimilarCourseItemResponse(): SimilarCourseItemResponse {
    val sortedByVisitOrder = places.sortedBy { it.visitOrder }
    return SimilarCourseItemResponse(
        courseId = id,
        title = title,
        travelDate = travelDate,
        endDate = endDate,
        placeCount = places.size,
        placePreviews = sortedByVisitOrder.take(ExploreService.PLACE_PREVIEW_LIMIT).map {
            SimilarCoursePlacePreview(name = it.place.name, thumbnailUrl = it.place.mainImageUrl)
        },
        nickname = user.nickname,
        profileImageUrl = user.profileImageUrl,
        authorUserId = user.id,
    )
}
