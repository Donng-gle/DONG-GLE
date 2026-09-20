package com.dongle.server.event

import com.dongle.server.common.PaginationMeta
import com.dongle.server.event.dto.EventListItemResponse
import com.dongle.server.event.dto.EventsResponse
import com.dongle.server.place.Place
import com.dongle.server.place.PlaceCategory
import com.dongle.server.place.PlaceRepository
import com.dongle.server.visitlog.LogEmotionTagRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.YearMonth
import java.time.temporal.ChronoUnit

@Service
@Transactional(readOnly = true)
class EventService(
    private val placeRepository: PlaceRepository,
    private val logEmotionTagRepository: LogEmotionTagRepository,
) {
    fun listEvents(month: String?, page: Int, size: Int): EventsResponse {
        val yearMonth = month?.let { YearMonth.parse(it) } ?: YearMonth.now()
        val pageable = PageRequest.of((page - 1).coerceAtLeast(0), size)

        val result = placeRepository.findEventsInMonth(
            PlaceCategory.축제행사,
            yearMonth.atDay(1),
            yearMonth.atEndOfMonth(),
            pageable,
        )

        return EventsResponse(
            events = result.content.map { it.toEventListItemResponse(logEmotionTagRepository) },
            meta = PaginationMeta(
                total = result.totalElements,
                page = page,
                size = size,
                hasNext = result.hasNext(),
            ),
        )
    }
}

// 방문 로그 누적 감성 태그를 조회 시점에 직접 집계 (2026-09-02 결정, decision-log 참고 — PlaceService.resolveTags와 동일한 이유)
private fun Place.toEventListItemResponse(logEmotionTagRepository: LogEmotionTagRepository): EventListItemResponse {
    val start = requireNotNull(eventStartDate) { "축제행사 장소는 event_start_date가 있어야 합니다. placeId=$id" }
    val end = requireNotNull(eventEndDate) { "축제행사 장소는 event_end_date가 있어야 합니다. placeId=$id" }

    return EventListItemResponse(
        id = id,
        name = name,
        mainImageUrl = mainImageUrl,
        addr1 = addr1,
        eventStartDate = start,
        eventEndDate = end,
        tags = logEmotionTagRepository.countTagsByPlaceId(id).take(3).map { it.tag },
        dDay = calculateDDay(start, end),
    )
}

private fun calculateDDay(start: LocalDate, end: LocalDate): Int {
    val today = LocalDate.now()
    return when {
        today.isBefore(start) -> ChronoUnit.DAYS.between(today, start).toInt()
        today.isAfter(end) -> -1
        else -> 0
    }
}
