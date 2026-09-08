package com.dongle.server.visitlog

import com.dongle.server.common.PaginationMeta
import com.dongle.server.course.Course
import com.dongle.server.course.CoursePlace
import com.dongle.server.course.CourseRepository
import com.dongle.server.course.CourseSource
import com.dongle.server.place.PlaceNotFoundException
import com.dongle.server.place.PlaceRepository
import com.dongle.server.user.UserRepository
import com.dongle.server.visitlog.dto.MyLogsResponse
import com.dongle.server.visitlog.dto.PlaceLogsResponse
import com.dongle.server.visitlog.dto.VisitLogCourseCreateRequest
import com.dongle.server.visitlog.dto.VisitLogCourseCreateResponse
import com.dongle.server.visitlog.dto.VisitLogCreateRequest
import com.dongle.server.visitlog.dto.VisitLogDetailResponse
import com.dongle.server.visitlog.dto.VisitLogMapItemResponse
import com.dongle.server.visitlog.dto.VisitLogPhotoResponse
import com.dongle.server.visitlog.dto.VisitLogSummaryResponse
import com.dongle.server.visitlog.dto.VisitLogUpdateRequest
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

@Service
@Transactional(readOnly = true)
class VisitLogService(
    private val visitLogRepository: VisitLogRepository,
    private val placeRepository: PlaceRepository,
    private val userRepository: UserRepository,
    private val courseRepository: CourseRepository,
) {
    // AI 이미지 분석 연동 전까지의 임시 스코프 (2026-08-30 결정, decision-log 참고): 방문 기록
    // 생성/저장은 지금 구현하되, 감성 태그 자동 부여(log_emotion_tag 적재)는 뺀다.
    // AI가 사진을 분석해서 log_emotion_tag에 직접 적재하는 별도 배치 경로로 진행하기로 확인됨
    // (2026-08-31 결정) — 이 메서드가 직접 태그를 채워넣을 필요는 없음. 장소의 감성 태그는
    // log_emotion_tag를 조회 시점에 집계해서 노출되므로(PlaceService.resolveTags 참고),
    // AI가 적재를 시작하면 이 메서드 변경 없이 자동으로 반영됨
    @Transactional
    fun create(userId: Long, placeId: Long, request: VisitLogCreateRequest): VisitLogDetailResponse {
        val place = placeRepository.findById(placeId).orElseThrow { PlaceNotFoundException(placeId) }
        val user = userRepository.getReferenceById(userId)

        val log = visitLogRepository.save(
            VisitLog(
                user = user,
                place = place,
                title = request.title,
                oneLine = request.oneLine,
                weather = request.weather,
                rating = request.rating,
                visitedAt = request.visitedAt ?: LocalDateTime.now(),
            )
        )
        // 요청 목록 순서를 그대로 sort_order로 저장(2026-09-06 결정, decision-log 참고) — cascade
        // ALL이라 log 저장 시(트랜잭션 커밋 시) 같이 insert됨, 별도 save 호출 불필요.
        // 사진별 캡션(2026-09-07 결정)도 같이 저장
        request.photos?.forEachIndexed { index, photo ->
            log.photos.add(VisitLogPhoto(visitLog = log, photoUrl = photo.url, caption = photo.caption, sortOrder = index))
        }
        place.visitLogCount += 1

        return log.toDetailResponse()
    }

    // 나의 일지 "기록하기"에서 장소를 2개 이상 골랐을 때 — course(source=journal) + 장소마다
    // visit_log를 한 트랜잭션으로 생성해서 같은 course_id로 묶는다 (2026-09-08 결정, decision-log 참고).
    // AI 감성 태그 자동 부여를 안 하는 이유는 위 create()와 동일(임시 스코프)
    @Transactional
    fun createCourseLog(userId: Long, request: VisitLogCourseCreateRequest): VisitLogCourseCreateResponse {
        val user = userRepository.getReferenceById(userId)
        val places = request.places.map { p ->
            val placeId = requireNotNull(p.placeId)
            placeRepository.findById(placeId).orElseThrow { PlaceNotFoundException(placeId) }
        }
        val visitedAt = request.places.firstNotNullOfOrNull { it.visitedAt } ?: LocalDateTime.now()

        val course = Course(
            user = user,
            title = request.courseTitle?.trim()?.takeIf { it.isNotEmpty() } ?: defaultCourseTitle(visitedAt),
            source = CourseSource.journal,
            travelDate = visitedAt.toLocalDate(),
        )
        places.forEachIndexed { index, place ->
            course.places.add(CoursePlace(course = course, place = place, visitOrder = index + 1))
        }
        courseRepository.save(course) // cascade로 course_place도 같이 insert됨

        val logs = request.places.zip(places).map { (p, place) ->
            val log = visitLogRepository.save(
                VisitLog(
                    user = user,
                    place = place,
                    course = course,
                    title = p.title,
                    oneLine = p.oneLine,
                    weather = p.weather,
                    rating = p.rating,
                    visitedAt = p.visitedAt ?: LocalDateTime.now(),
                )
            )
            p.photos?.forEachIndexed { photoIndex, photo ->
                log.photos.add(VisitLogPhoto(visitLog = log, photoUrl = photo.url, caption = photo.caption, sortOrder = photoIndex))
            }
            place.visitLogCount += 1
            log
        }

        return VisitLogCourseCreateResponse(courseId = course.id, logs = logs.map { it.toDetailResponse() })
    }

    private fun defaultCourseTitle(visitedAt: LocalDateTime): String =
        "${visitedAt.format(DateTimeFormatter.ofPattern("M월 d일"))}의 코스"

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
        // 빈 문자열은 "리뷰 지움"으로 취급해 null로 저장. 필드 자체가 없는 요청(과거엔 프론트가
        // 빈 값을 아예 생략해서 보냈음)과 "지움"을 구분할 방법이 nullable 필드만으론 없어서,
        // 프론트가 항상 trim된 값을 보내도록 맞추고(빈 문자열 포함) 여기서 blank를 null로 정규화하는
        // 쪽으로 계약을 명확히 함 — 안 그러면 리뷰를 지워도 예전 값이 그대로 남는 버그가 있었음
        // (2026-09-04 발견/수정, decision-log 참고)
        request.title?.let { log.title = it.ifBlank { null } }
        request.oneLine?.let { log.oneLine = it.ifBlank { null } }
        request.weather?.let { log.weather = it.ifBlank { null } }
        request.rating?.let { log.rating = it }
        request.visitedAt?.let { log.visitedAt = it }
        return log.toDetailResponse()
    }

    @Transactional
    fun delete(userId: Long, logId: Long) {
        val log = findOwnedLog(userId, logId)
        val place = log.place

        place.visitLogCount = (place.visitLogCount - 1).coerceAtLeast(0)

        // log_emotion_tag는 visit_log 삭제 시 FK ON DELETE CASCADE로 같이 지워짐 — 장소의 감성 태그는
        // 조회 시점에 log_emotion_tag를 직접 집계하므로(LogEmotionTagRepository.countTagsByPlaceId)
        // 여기서 별도로 카운트를 갱신할 대상 자체가 없음 (2026-09-02 결정, decision-log 참고)
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
    photos = photos.map { it.toResponse() },
    title = title,
    oneLine = oneLine,
    weather = weather,
    rating = rating,
    visitedAt = visitedAt,
    tags = emotionTags.map { it.tag },
)

private fun VisitLog.toDetailResponse() = VisitLogDetailResponse(
    id = id,
    placeId = place.id,
    placeName = place.name,
    courseId = course?.id,
    courseTitle = course?.title,
    photos = photos.map { it.toResponse() },
    title = title,
    oneLine = oneLine,
    weather = weather,
    rating = rating,
    visitedAt = visitedAt,
    tags = emotionTags.map { it.tag },
)

private fun VisitLog.toMapItemResponse() = VisitLogMapItemResponse(
    id = id,
    placeId = place.id,
    placeName = place.name,
    courseId = course?.id,
    courseTitle = course?.title,
    lat = place.lat,
    lng = place.lng,
    photos = photos.map { it.toResponse() },
    title = title,
    oneLine = oneLine,
    weather = weather,
    rating = rating,
    visitedAt = visitedAt,
    tags = emotionTags.map { it.tag },
)

private fun VisitLogPhoto.toResponse() = VisitLogPhotoResponse(url = photoUrl, caption = caption)
