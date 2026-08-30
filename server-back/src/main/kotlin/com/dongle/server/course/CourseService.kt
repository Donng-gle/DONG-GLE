package com.dongle.server.course

import com.dongle.server.common.PaginationMeta
import com.dongle.server.course.dto.CourseCandidateResponse
import com.dongle.server.course.dto.CourseDetailResponse
import com.dongle.server.course.dto.CourseGenerateRequest
import com.dongle.server.course.dto.CourseGenerateResponse
import com.dongle.server.course.dto.CourseListItemResponse
import com.dongle.server.course.dto.CourseManualRequest
import com.dongle.server.course.dto.CoursePlaceItemResponse
import com.dongle.server.course.dto.CoursePlaceRequest
import com.dongle.server.course.dto.CourseSaveRequest
import com.dongle.server.course.dto.CourseSaveResponse
import com.dongle.server.course.dto.CourseUpdateRequest
import com.dongle.server.course.dto.MyCoursesResponse
import com.dongle.server.course.optimizer.CandidatePlace
import com.dongle.server.course.optimizer.CourseOptimizationResult
import com.dongle.server.course.optimizer.CourseOptimizerClient
import com.dongle.server.course.optimizer.LatLng
import com.dongle.server.course.optimizer.MajorScores
import com.dongle.server.course.optimizer.TransportMode
import com.dongle.server.course.optimizer.TripInput
import com.dongle.server.place.Place
import com.dongle.server.place.PlaceNotFoundException
import com.dongle.server.place.PlaceRepository
import com.dongle.server.place.PlaceSemanticVector
import com.dongle.server.place.PlaceService
import com.dongle.server.swipe.SwipeService
import com.dongle.server.swipe.SwipeSessionCandidate
import com.dongle.server.swipe.SwipeTransport
import com.dongle.server.user.UserRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper
import java.time.LocalDateTime
import java.time.LocalTime
import java.util.UUID

@Service
@Transactional(readOnly = true)
class CourseService(
    private val courseRepository: CourseRepository,
    private val placeRepository: PlaceRepository,
    private val placeService: PlaceService,
    private val userRepository: UserRepository,
    private val swipeService: SwipeService,
    private val courseOptimizerClient: CourseOptimizerClient,
    private val objectMapper: ObjectMapper,
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

    // 스와이프 세션(like/must) → ai/course_optimizer 호출 → 코스 후보 변환.
    // api_1.3.1v.yaml은 최대 3개 후보를 기대하지만 course_optimizer는 1개 최적 경로만 반환 가능해서
    // 항상 1개만 채운다 (CourseGenerateResponse 주석 참고, 3개 확장은 별도 논의 대상).
    // must 강제 포함도 course_optimizer에 없는 개념이라, 후보 풀 자체를 like/must로 좁혀서 근사한다
    // (SwipeService.likedOrMustCandidates 참고).
    @Transactional
    fun generate(userId: Long, request: CourseGenerateRequest): CourseGenerateResponse {
        val sessionId = requireNotNull(request.sessionId)
        val travelDate = requireNotNull(request.travelDate)
        val transport = requireNotNull(request.transport)

        val candidates = swipeService.likedOrMustCandidates(userId, sessionId)
        val vectors = placeService.semanticVectorsByPlaceId(candidates.map { it.place.id })
        val optimizerCandidates = candidates.mapNotNull { it.toOptimizerCandidateOrNull(vectors[it.place.id]) }
        if (optimizerCandidates.size < MIN_VISIT_COUNT) throw NotEnoughSwipeCandidatesException(optimizerCandidates.size)

        val tripInput = TripInput(
            startTime = travelDate.atTime(DAY_START),
            endTime = travelDate.atTime(DAY_END),
            transportMode = transport.toOptimizerMode(),
            origin = DEFAULT_ORIGIN,
            candidates = optimizerCandidates,
        )
        val result = courseOptimizerClient.optimizeCourse(tripInput)
        val placesById = candidates.associate { it.place.id.toString() to it.place }

        return CourseGenerateResponse(candidates = listOf(result.toCourseCandidateResponse(placesById)))
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

    // api_1.3.1v.yaml의 SwipeTransport(car/walk/public) ↔ course_optimizer.TransportMode(walk/transit/car) 매핑.
    // public과 transit은 실제로 같은 개념(대중교통)이라 값 이름만 다를 뿐 의미상 매핑은 명확함
    private fun SwipeTransport.toOptimizerMode(): TransportMode = when (this) {
        SwipeTransport.car -> TransportMode.car
        SwipeTransport.walk -> TransportMode.walk
        SwipeTransport.`public` -> TransportMode.transit
    }

    // 좌표 없는 장소(스키마상 nullable)는 course_optimizer에 보낼 수 없어 조용히 제외
    private fun SwipeSessionCandidate.toOptimizerCandidateOrNull(vector: PlaceSemanticVector?): CandidatePlace? {
        val lat = place.lat ?: return null
        val lng = place.lng ?: return null
        return CandidatePlace(
            placeId = place.id.toString(),
            category = place.category.name,
            majorScores = vector?.toOptimizerMajorScoresOrNull(objectMapper) ?: NEUTRAL_MAJOR_SCORES,
            latitude = lat,
            longitude = lng,
            name = place.name,
            isOpen = true, // course_optimizer가 자체적으로 영업 상태를 재검증함 (ensure_open_candidates)
        )
    }

    private fun PlaceSemanticVector.toOptimizerMajorScoresOrNull(mapper: ObjectMapper): MajorScores? =
        try {
            val node = mapper.readTree(majorScores)
            MajorScores(
                relaxing = node.get("relaxing")?.asDouble() ?: 0.5,
                lively = node.get("lively")?.asDouble() ?: 0.5,
                romantic = node.get("romantic")?.asDouble() ?: 0.5,
                local = node.get("local")?.asDouble() ?: 0.5,
                photogenic = node.get("photogenic")?.asDouble() ?: 0.5,
                traditional = node.get("traditional")?.asDouble() ?: 0.5,
                modern = node.get("modern")?.asDouble() ?: 0.5,
            )
        } catch (e: Exception) {
            null
        }

    private fun CourseOptimizationResult.toCourseCandidateResponse(placesById: Map<String, Place>): CourseCandidateResponse {
        val places = selectedRoute.stops.mapIndexed { index, stop ->
            val place = placesById[stop.placeId]
            CoursePlaceItemResponse(
                placeId = place?.id ?: stop.placeId.toLongOrNull() ?: -1L,
                name = place?.name ?: stop.placeId,
                visitOrder = index + 1,
                plannedTime = stop.visitStartTime.toLocalTime().toString(),
                lat = place?.lat,
                lng = place?.lng,
                mainImageUrl = place?.mainImageUrl,
                distanceFromPrevKm = null,
                durationFromPrevMin = null,
            )
        }
        return CourseCandidateResponse(
            candidateId = "course_candidate_" + UUID.randomUUID(),
            title = DEFAULT_COURSE_TITLE,
            places = places,
            totalDistanceKm = null,
            totalDurationMin = selectedRoute.score.totalTravelMinutes,
        )
    }

    companion object {
        // ai/course_optimizer.config.CourseOptimizerConfig.min_visit_count 기본값(2)과 맞춤 —
        // AI 서비스까지 호출하지 않고 여기서 먼저 걸러내기 위한 미러링 값
        private const val MIN_VISIT_COUNT = 2
        private val DAY_START: LocalTime = LocalTime.of(9, 0)
        private val DAY_END: LocalTime = LocalTime.of(21, 0)

        // CourseGenerateRequest/api_1.3.1v.yaml에 사용자 현재 위치 필드가 없어서 임시로 안동 시내
        // 대표 좌표를 출발점으로 고정 사용 (실제 GPS 연동 전까지의 MVP 근사치, decision-log 참고)
        private val DEFAULT_ORIGIN = LatLng(latitude = 36.5684, longitude = 128.7294)

        private val NEUTRAL_MAJOR_SCORES = MajorScores(
            relaxing = 0.5,
            lively = 0.5,
            romantic = 0.5,
            local = 0.5,
            photogenic = 0.5,
            traditional = 0.5,
            modern = 0.5,
        )

        private const val DEFAULT_COURSE_TITLE = "안동 하루 코스"
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
