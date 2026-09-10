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
import com.dongle.server.course.directions.GoogleRoutesClient
import com.dongle.server.course.directions.GoogleTravelMode
import com.dongle.server.course.directions.RouteResult
import com.dongle.server.course.optimizer.CandidatePlace
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
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.temporal.ChronoUnit
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
    private val googleRoutesClient: GoogleRoutesClient,
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
        val source = requireNotNull(request.source)
        // journal은 나의 일지 "기록하기"(POST /logs/course)에서만 서버가 직접 부여하는 값 —
        // 이 범용 저장 API로 흉내낼 수 없게 막음(2026-09-08 결정, decision-log 참고)
        if (source == CourseSource.journal) throw InvalidCourseSourceException("source는 ai, ai_edited, user 중 하나여야 합니다.")
        // 여러 날 AI 코스 저장 지원(2026-09-10 추가) — saveManual()과 동일 규칙
        if (request.endDate != null && request.travelDate != null && request.endDate < request.travelDate) {
            throw InvalidCourseDateRangeException()
        }

        val course = Course(
            user = userRepository.getReferenceById(userId),
            title = request.title,
            source = source,
            travelDate = request.travelDate,
            endDate = request.endDate,
            transport = request.transport,
        )
        applyPlaces(course, request.places)
        return CourseSaveResponse(courseId = courseRepository.save(course).id)
    }

    @Transactional
    fun saveManual(userId: Long, request: CourseManualRequest): CourseSaveResponse {
        if (request.endDate != null && request.travelDate != null && request.endDate < request.travelDate) {
            throw InvalidCourseDateRangeException()
        }
        // 여러 날 코스 지원(2026-09-06 결정, decision-log 참고) — 장소별 visitDate가 있으면
        // travelDate~endDate(하루짜리면 travelDate 하루) 범위 안인지 검증
        if (request.travelDate != null) {
            val rangeEnd = request.endDate ?: request.travelDate
            request.places.forEach { p ->
                val visitDate = p.visitDate?.let { LocalDate.parse(it) } ?: return@forEach
                if (visitDate < request.travelDate || visitDate > rangeEnd) throw InvalidCourseDateRangeException()
            }
        }
        val course = Course(
            user = userRepository.getReferenceById(userId),
            title = request.title,
            source = CourseSource.user,
            travelDate = request.travelDate,
            endDate = request.endDate,
            transport = request.transport,
        )
        applyPlaces(course, request.places)
        return CourseSaveResponse(courseId = courseRepository.save(course).id)
    }

    // 스와이프 세션(like/must) → ai/course_optimizer 호출 → 코스 후보 변환.
    // api_1.3.1v.yaml은 최대 3개 후보를 기대하지만 course_optimizer는 1개 최적 경로만 반환 가능해서
    // 항상 1개만 채운다 (CourseGenerateResponse 주석 참고, 3개 확장은 별도 논의 대상).
    // must 강제 포함도 course_optimizer에 없는 개념이라, 후보 풀 자체를 like/must로 좁혀서 근사한다
    // (SwipeService.likedOrMustCandidates 참고).
    //
    // 여행 날짜 다중 선택 지원(2026-09-10 추가, decision-log 참고) — travelDate~endDate 범위의
    // 날짜마다 course_optimizer를 한 번씩 따로 호출해서 하루치 코스를 짜고 이어붙인다("날짜별로 따로
    // AI 추천" 방식, 사용자 확인). 같은 장소가 여러 날 중복되지 않도록 하루 끝날 때마다 그날 뽑힌
    // 장소를 다음 날 후보 풀에서 뺀다. 뒷날로 갈수록 남는 후보가 줄어 MIN_VISIT_COUNT(2)에 못 미치면
    // 그 날부터는 생성을 멈춘다(좋아요 누른 장소를 이미 다 썼다는 뜻 — 억지로 채우기보다 만들어진
    // 날짜만큼만 돌려줌). 하루짜리 요청(endDate 없음)은 기존과 동일하게 한 번만 호출됨
    @Transactional
    fun generate(userId: Long, request: CourseGenerateRequest): CourseGenerateResponse {
        val sessionId = requireNotNull(request.sessionId)
        val travelDate = requireNotNull(request.travelDate)
        val transport = requireNotNull(request.transport)
        val endDate = request.endDate ?: travelDate
        if (endDate < travelDate) throw InvalidCourseDateRangeException()

        // 여행일정 등록 화면(TimePicker)에서 받은 시작/종료 시간 — 안 고르면 기존 기본값(DAY_START~
        // DAY_END)으로 폴백(2026-09-09 추가, decision-log 참고). 둘 다 있을 때만 순서 검증(하나만
        // 오면 나머지는 기본값을 쓰므로 역전 비교가 의미 없음)
        val startTime = request.startTime ?: DAY_START
        val endTime = request.endTime ?: DAY_END
        if (request.startTime != null && request.endTime != null && endTime <= startTime) {
            throw InvalidCourseTimeRangeException()
        }

        val candidates = swipeService.likedOrMustCandidates(userId, sessionId)
        val vectors = placeService.semanticVectorsByPlaceId(candidates.map { it.place.id })
        val placesById = candidates.associate { it.place.id.toString() to it.place }
        var pool = candidates.mapNotNull { it.toOptimizerCandidateOrNull(vectors[it.place.id]) }
        if (pool.size < MIN_VISIT_COUNT) throw NotEnoughSwipeCandidatesException(pool.size)

        val allPlaces = mutableListOf<CoursePlaceItemResponse>()
        // 거리는 구글 Directions 실패 시 원래도 null(코스 자체는 만들어지되 "거리 모름"을 그대로
        // 보여줌, courseOptimizer는 km를 안 줌) — 날짜별로 합산하면서 이 null 의미를 그대로 유지:
        // 하루라도 실제 거리를 얻으면 그 값들만 합산, 전부 실패면 총합도 null(단순히 0으로 덮어쓰지
        // 않음, 2026-09-10 다중 날짜 추가하면서 정정)
        var totalDistanceKm: Double? = null
        var totalDurationMin = 0
        var visitOrderCursor = 0
        var date = travelDate
        while (!date.isAfter(endDate) && pool.size >= MIN_VISIT_COUNT) {
            val tripInput = TripInput(
                startTime = date.atTime(startTime),
                endTime = date.atTime(endTime),
                transportMode = transport.toOptimizerMode(),
                origin = DEFAULT_ORIGIN,
                candidates = pool,
            )
            val result = courseOptimizerClient.optimizeCourse(tripInput)
            val stopPlaces = result.selectedRoute.stops.mapNotNull { placesById[it.placeId] }
            val route = routeFor(stopPlaces, transport.toGoogleTravelMode())

            result.selectedRoute.stops.forEachIndexed { index, stop ->
                val place = placesById[stop.placeId]
                val leg = if (index == 0) null else route?.legs?.getOrNull(index - 1)
                visitOrderCursor += 1
                allPlaces += CoursePlaceItemResponse(
                    placeId = place?.id ?: stop.placeId.toLongOrNull() ?: -1L,
                    name = place?.name ?: stop.placeId,
                    visitOrder = visitOrderCursor,
                    plannedTime = stop.visitStartTime.toLocalTime().toString(),
                    lat = place?.lat,
                    lng = place?.lng,
                    mainImageUrl = place?.mainImageUrl,
                    distanceFromPrevKm = leg?.distanceMeters?.let { it / 1000.0 },
                    durationFromPrevMin = leg?.durationSeconds?.let { Math.round(it / 60.0).toInt() },
                    visitDate = date.toString(),
                    category = place?.category?.name,
                )
            }
            route?.totalDistanceMeters?.let { totalDistanceKm = (totalDistanceKm ?: 0.0) + it / 1000.0 }
            totalDurationMin += route?.totalDurationSeconds?.let { Math.round(it / 60.0).toInt() }
                ?: result.selectedRoute.score.totalTravelMinutes

            val usedIds = result.selectedRoute.stops.map { it.placeId }.toSet()
            pool = pool.filterNot { it.placeId in usedIds }
            date = date.plusDays(1)
        }

        val candidateResponse = CourseCandidateResponse(
            candidateId = "course_candidate_" + UUID.randomUUID(),
            title = courseTitleFor(travelDate, endDate),
            places = allPlaces,
            totalDistanceKm = totalDistanceKm,
            totalDurationMin = totalDurationMin,
        )
        return CourseGenerateResponse(candidates = listOf(candidateResponse))
    }

    fun getDetail(userId: Long, courseId: Long): CourseDetailResponse =
        courseDetailWithRoute(findOwnedCourse(userId, courseId))

    // "취향 맞춤 코스" 탭에서 "자세히 보기" — 소유자 확인 대신 공개 여부만 확인(2026-09-07 결정,
    // decision-log 참고). userId 파라미터는 안 받음(본인 여부와 무관하게 공개면 누구나 조회 가능)
    fun getPublicDetail(courseId: Long): CourseDetailResponse {
        val course = courseRepository.findById(courseId).orElseThrow { CourseNotFoundException(courseId) }
        if (!course.isPublic) throw CourseNotPublicException()
        return courseDetailWithRoute(course)
    }

    @Transactional
    fun update(userId: Long, courseId: Long, request: CourseUpdateRequest): CourseDetailResponse {
        val course = findOwnedCourse(userId, courseId)

        request.title?.let { course.title = it }
        request.source?.let {
            if (it == CourseSource.ai || it == CourseSource.journal) throw InvalidCourseSourceException()
            course.source = it
        }
        request.places?.let { applyPlaces(course, it) }
        course.updatedAt = LocalDateTime.now()

        return courseDetailWithRoute(course)
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
                    visitDate = item.visitDate?.let { LocalDate.parse(it) },
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

    // api_1.3.1v.yaml의 SwipeTransport(car/walk/public) ↔ Google Routes API TravelMode(DRIVE/WALK/TRANSIT) 매핑
    private fun SwipeTransport.toGoogleTravelMode(): GoogleTravelMode = when (this) {
        SwipeTransport.car -> GoogleTravelMode.DRIVE
        SwipeTransport.walk -> GoogleTravelMode.WALK
        SwipeTransport.`public` -> GoogleTravelMode.TRANSIT
    }

    // 저장된 코스 조회/수정 응답에 구글맵 경로(이동거리/시간/폴리라인)를 재계산해서 채워넣는 공통 경로.
    // course.transport가 없으면(과거 데이터, 직접 코스 짜기에서 미입력) walk로 기본 계산
    private fun courseDetailWithRoute(course: Course): CourseDetailResponse {
        val sorted = course.places.sortedBy { it.visitOrder }
        val route = routeFor(sorted.map { it.place }, (course.transport ?: SwipeTransport.walk).toGoogleTravelMode())
        return course.toDetailResponse(sorted, route)
    }

    // 좌표 없는 장소가 하나라도 섞여 있으면(스키마상 nullable) leg 인덱스가 안 맞게 되므로 아예 계산을 건너뛴다.
    // Google Routes API 자체가 실패해도 GoogleRoutesClient가 null로 폴백하므로 코스 표시 자체는 항상 가능
    private fun routeFor(places: List<Place>, mode: GoogleTravelMode): RouteResult? {
        val waypoints = places.mapNotNull { p -> p.lat?.let { lat -> p.lng?.let { lng -> LatLng(lat, lng) } } }
        if (waypoints.size != places.size || waypoints.size < 2) return null
        return googleRoutesClient.computeRoute(waypoints, mode)
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

    // 하루짜리면 기존 그대로 "안동 하루 코스", 여러 날이면 "안동 N박 M일 코스"(2026-09-10 다중 날짜
    // 지원 추가)
    private fun courseTitleFor(travelDate: LocalDate, endDate: LocalDate): String {
        val days = ChronoUnit.DAYS.between(travelDate, endDate).toInt() + 1
        return if (days <= 1) DEFAULT_COURSE_TITLE else "안동 ${days - 1}박 ${days}일 코스"
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

private fun Course.toListItemResponse(): CourseListItemResponse {
    val sortedByVisitOrder = places.sortedBy { it.visitOrder }
    return CourseListItemResponse(
        id = id,
        title = title,
        travelDate = travelDate,
        endDate = endDate,
        source = source.name,
        placeCount = places.size,
        thumbnailUrl = sortedByVisitOrder.firstOrNull()?.place?.mainImageUrl,
        placeThumbnails = sortedByVisitOrder.take(SCRAPBOOK_THUMBNAIL_LIMIT).mapNotNull { it.place.mainImageUrl },
        createdAt = createdAt,
    )
}

// Figma "코스 저장" 카드의 썸네일 스트립 장수(3장 + "N+" 배지, 2026-09-05 추가)
private const val SCRAPBOOK_THUMBNAIL_LIMIT = 3

private fun Course.toDetailResponse(sortedPlaces: List<CoursePlace>, route: RouteResult?) = CourseDetailResponse(
    id = id,
    title = title,
    travelDate = travelDate,
    endDate = endDate,
    source = source.name,
    places = sortedPlaces.mapIndexed { index, cp ->
        val leg = if (index == 0) null else route?.legs?.getOrNull(index - 1)
        CoursePlaceItemResponse(
            placeId = cp.place.id,
            name = cp.place.name,
            visitOrder = cp.visitOrder,
            plannedTime = cp.plannedTime?.toString(),
            lat = cp.place.lat,
            lng = cp.place.lng,
            mainImageUrl = cp.place.mainImageUrl,
            distanceFromPrevKm = leg?.distanceMeters?.let { it / 1000.0 },
            durationFromPrevMin = leg?.durationSeconds?.let { Math.round(it / 60.0).toInt() },
            visitDate = cp.visitDate?.toString(),
            category = cp.place.category.name,
        )
    },
    totalDistanceKm = route?.totalDistanceMeters?.let { it / 1000.0 },
    totalDurationMin = route?.totalDurationSeconds?.let { Math.round(it / 60.0).toInt() },
    polyline = route?.encodedPolyline,
    updatedAt = updatedAt,
)
