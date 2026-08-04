package com.dongle.server.course

import com.dongle.server.common.PaginationMeta
import com.dongle.server.course.dto.CourseDetailResponse
import com.dongle.server.course.dto.CourseListItemResponse
import com.dongle.server.course.dto.CourseManualRequest
import com.dongle.server.course.dto.CoursePlaceItemResponse
import com.dongle.server.course.dto.CoursePlaceRequest
import com.dongle.server.course.dto.CourseSaveRequest
import com.dongle.server.course.dto.CourseSaveResponse
import com.dongle.server.course.dto.CourseUpdateRequest
import com.dongle.server.course.dto.MyCoursesResponse
import com.dongle.server.place.PlaceNotFoundException
import com.dongle.server.place.PlaceRepository
import com.dongle.server.user.UserRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime
import java.time.LocalTime

@Service
@Transactional(readOnly = true)
class CourseService(
    private val courseRepository: CourseRepository,
    private val placeRepository: PlaceRepository,
    private val userRepository: UserRepository,
) {
    fun myCourses(userId: Long, page: Int, size: Int): MyCoursesResponse {
        val pageable = PageRequest.of((page - 1).coerceAtLeast(0), size)
        val result = courseRepository.findByUserId(userId, pageable)

        return MyCoursesResponse(
            courses = result.content.map { it.toListItemResponse() },
            meta = PaginationMeta(
                total = result.totalElements,
                page = page,
                size = size,
                hasNext = result.hasNext(),
            ),
        )
    }

    @Transactional
    fun save(userId: Long, request: CourseSaveRequest): CourseSaveResponse {
        val course = Course(
            user = userRepository.getReferenceById(userId),
            title = request.title,
            source = requireNotNull(request.source),
            travelDate = request.travelDate,
        )
        applyPlaces(course, request.places)
        return CourseSaveResponse(courseId = courseRepository.save(course).id)
    }

    @Transactional
    fun saveManual(userId: Long, request: CourseManualRequest): CourseSaveResponse {
        val course = Course(
            user = userRepository.getReferenceById(userId),
            title = request.title,
            source = CourseSource.user,
            travelDate = request.travelDate,
        )
        applyPlaces(course, request.places)
        return CourseSaveResponse(courseId = courseRepository.save(course).id)
    }

    fun getDetail(userId: Long, courseId: Long): CourseDetailResponse =
        findOwnedCourse(userId, courseId).toDetailResponse()

    @Transactional
    fun update(userId: Long, courseId: Long, request: CourseUpdateRequest): CourseDetailResponse {
        val course = findOwnedCourse(userId, courseId)

        request.title?.let { course.title = it }
        request.source?.let {
            if (it == CourseSource.ai) throw InvalidCourseSourceException()
            course.source = it
        }
        request.places?.let { applyPlaces(course, it) }
        course.updatedAt = LocalDateTime.now()

        return course.toDetailResponse()
    }

    @Transactional
    fun delete(userId: Long, courseId: Long) {
        courseRepository.delete(findOwnedCourse(userId, courseId))
    }

    private fun findOwnedCourse(userId: Long, courseId: Long): Course {
        val course = courseRepository.findById(courseId).orElseThrow { CourseNotFoundException(courseId) }
        if (course.user.id != userId) throw CourseAccessDeniedException()
        return course
    }

    private fun applyPlaces(course: Course, items: List<CoursePlaceRequest>) {
        course.places.clear()
        items.forEach { item ->
            val placeId = requireNotNull(item.placeId)
            val place = placeRepository.findById(placeId).orElseThrow { PlaceNotFoundException(placeId) }
            course.places.add(
                CoursePlace(
                    course = course,
                    place = place,
                    visitOrder = requireNotNull(item.visitOrder),
                    plannedTime = item.plannedTime?.let { LocalTime.parse(it) },
                )
            )
        }
    }
}

private fun Course.toListItemResponse() = CourseListItemResponse(
    id = id,
    title = title,
    travelDate = travelDate,
    source = source.name,
    placeCount = places.size,
    thumbnailUrl = places.minByOrNull { it.visitOrder }?.place?.mainImageUrl,
    createdAt = createdAt,
)

private fun Course.toDetailResponse() = CourseDetailResponse(
    id = id,
    title = title,
    travelDate = travelDate,
    source = source.name,
    places = places.sortedBy { it.visitOrder }.map {
        CoursePlaceItemResponse(
            placeId = it.place.id,
            name = it.place.name,
            visitOrder = it.visitOrder,
            plannedTime = it.plannedTime?.toString(),
            lat = it.place.lat,
            lng = it.place.lng,
            mainImageUrl = it.place.mainImageUrl,
            distanceFromPrevKm = null,
            durationFromPrevMin = null,
        )
    },
    totalDistanceKm = null,
    totalDurationMin = null,
    polyline = null,
    updatedAt = updatedAt,
)
