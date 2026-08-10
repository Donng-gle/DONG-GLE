package com.dongle.server.visitlog

import com.dongle.server.common.PaginationMeta
import com.dongle.server.place.PlaceEmotionTagRepository
import com.dongle.server.place.PlaceNotFoundException
import com.dongle.server.place.PlaceRepository
import com.dongle.server.visitlog.dto.MyLogsResponse
import com.dongle.server.visitlog.dto.PlaceLogsResponse
import com.dongle.server.visitlog.dto.VisitLogDetailResponse
import com.dongle.server.visitlog.dto.VisitLogMapItemResponse
import com.dongle.server.visitlog.dto.VisitLogSummaryResponse
import com.dongle.server.visitlog.dto.VisitLogUpdateRequest
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional(readOnly = true)
class VisitLogService(
    private val visitLogRepository: VisitLogRepository,
    private val placeRepository: PlaceRepository,
    private val placeEmotionTagRepository: PlaceEmotionTagRepository,
) {
    fun myLogs(userId: Long, page: Int, size: Int): MyLogsResponse {
        val pageable = PageRequest.of((page - 1).coerceAtLeast(0), size)
        val result = visitLogRepository.findByUserId(userId, pageable)

        return MyLogsResponse(
            logs = result.content.map { it.toMapItemResponse() },
            meta = PaginationMeta(
                total = result.totalElements,
                page = page,
                size = size,
                hasNext = result.hasNext(),
            ),
        )
    }

    fun logsForPlace(placeId: Long, page: Int, size: Int): PlaceLogsResponse {
        if (!placeRepository.existsById(placeId)) throw PlaceNotFoundException(placeId)

        val pageable = PageRequest.of((page - 1).coerceAtLeast(0), size)
        val result = visitLogRepository.findByPlaceId(placeId, pageable)

        return PlaceLogsResponse(
            logs = result.content.map { it.toSummaryResponse() },
            meta = PaginationMeta(
                total = result.totalElements,
                page = page,
                size = size,
                hasNext = result.hasNext(),
            ),
        )
    }

    fun getDetail(userId: Long, logId: Long): VisitLogDetailResponse =
        findOwnedLog(userId, logId).toDetailResponse()

    @Transactional
    fun update(userId: Long, logId: Long, request: VisitLogUpdateRequest): VisitLogDetailResponse {
        val log = findOwnedLog(userId, logId)
        request.oneLine?.let { log.oneLine = it }
        request.visitedAt?.let { log.visitedAt = it }
        return log.toDetailResponse()
    }

    @Transactional
    fun delete(userId: Long, logId: Long) {
        val log = findOwnedLog(userId, logId)
        val place = log.place

        place.visitLogCount = (place.visitLogCount - 1).coerceAtLeast(0)

        log.emotionTags.forEach { logTag ->
            val placeTag = placeEmotionTagRepository.findByPlaceIdAndTag(place.id, logTag.tag) ?: return@forEach
            if (placeTag.count <= 1) placeEmotionTagRepository.delete(placeTag) else placeTag.count -= 1
        }

        visitLogRepository.delete(log)
    }

    private fun findOwnedLog(userId: Long, logId: Long): VisitLog {
        val log = visitLogRepository.findById(logId).orElseThrow { VisitLogNotFoundException(logId) }
        if (log.user.id != userId) throw VisitLogAccessDeniedException()
        return log
    }
}

private fun VisitLog.toSummaryResponse() = VisitLogSummaryResponse(
    id = id,
    photoUrl = photoUrl,
    oneLine = oneLine,
    visitedAt = visitedAt,
    tags = emotionTags.map { it.tag },
)

private fun VisitLog.toDetailResponse() = VisitLogDetailResponse(
    id = id,
    placeId = place.id,
    placeName = place.name,
    photoUrl = photoUrl,
    oneLine = oneLine,
    visitedAt = visitedAt,
    tags = emotionTags.map { it.tag },
)

private fun VisitLog.toMapItemResponse() = VisitLogMapItemResponse(
    id = id,
    placeId = place.id,
    placeName = place.name,
    lat = place.lat,
    lng = place.lng,
    photoUrl = photoUrl,
    oneLine = oneLine,
    visitedAt = visitedAt,
    tags = emotionTags.map { it.tag },
)
