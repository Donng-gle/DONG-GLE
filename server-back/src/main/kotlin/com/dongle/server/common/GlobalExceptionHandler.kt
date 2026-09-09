package com.dongle.server.common

import com.dongle.server.auth.InvalidGoogleIdTokenException
import com.dongle.server.auth.InvalidOAuthCodeException
import com.dongle.server.auth.InvalidRefreshTokenException
import com.dongle.server.course.CourseAccessDeniedException
import com.dongle.server.course.CourseNotFoundException
import com.dongle.server.course.CourseNotPublicException
import com.dongle.server.course.InvalidCourseDateRangeException
import com.dongle.server.course.InvalidCourseSourceException
import com.dongle.server.course.InvalidCourseTimeRangeException
import com.dongle.server.course.NotEnoughSwipeCandidatesException
import com.dongle.server.course.optimizer.CourseOptimizerUpstreamException
import com.dongle.server.image.ImageProxyUpstreamException
import com.dongle.server.image.InvalidPhotoReferenceException
import com.dongle.server.onboarding.OnboardingCardAlreadySwipedException
import com.dongle.server.onboarding.OnboardingCardNotFoundException
import com.dongle.server.place.PlaceAlreadyLikedException
import com.dongle.server.place.PlaceLikeNotFoundException
import com.dongle.server.place.PlaceNotFoundException
import com.dongle.server.recommend.PlaceRecommenderUpstreamException
import com.dongle.server.swipe.SwipeCandidateNotFoundException
import com.dongle.server.swipe.SwipeSessionAccessDeniedException
import com.dongle.server.swipe.SwipeSessionExpiredException
import com.dongle.server.swipe.SwipeSessionNotFoundException
import com.dongle.server.upload.UnsupportedContentTypeException
import com.dongle.server.user.UserNotFoundException
import com.dongle.server.visitlog.VisitLogAccessDeniedException
import com.dongle.server.visitlog.VisitLogNotFoundException
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class GlobalExceptionHandler {

    @ExceptionHandler(PlaceNotFoundException::class)
    fun handlePlaceNotFound(ex: PlaceNotFoundException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ErrorResponse(code = "PLACE_NOT_FOUND", message = ex.message ?: "장소를 찾을 수 없습니다."))

    @ExceptionHandler(UserNotFoundException::class)
    fun handleUserNotFound(ex: UserNotFoundException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ErrorResponse(code = "USER_NOT_FOUND", message = ex.message ?: "사용자를 찾을 수 없습니다."))

    @ExceptionHandler(InvalidOAuthCodeException::class)
    fun handleInvalidOAuthCode(ex: InvalidOAuthCodeException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(ErrorResponse(code = "INVALID_OAUTH_CODE", message = ex.message ?: "잘못된 인가 코드입니다."))

    @ExceptionHandler(InvalidGoogleIdTokenException::class)
    fun handleInvalidGoogleIdToken(ex: InvalidGoogleIdTokenException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(ErrorResponse(code = "INVALID_GOOGLE_ID_TOKEN", message = ex.message ?: "유효하지 않은 구글 ID 토큰입니다."))

    @ExceptionHandler(InvalidRefreshTokenException::class)
    fun handleInvalidRefreshToken(ex: InvalidRefreshTokenException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(ErrorResponse(code = "INVALID_REFRESH_TOKEN", message = ex.message ?: "유효하지 않은 리프레시 토큰입니다."))

    @ExceptionHandler(PlaceAlreadyLikedException::class)
    fun handlePlaceAlreadyLiked(ex: PlaceAlreadyLikedException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.CONFLICT)
            .body(ErrorResponse(code = "PLACE_ALREADY_LIKED", message = ex.message ?: "이미 좋아요한 장소입니다."))

    @ExceptionHandler(PlaceLikeNotFoundException::class)
    fun handlePlaceLikeNotFound(ex: PlaceLikeNotFoundException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ErrorResponse(code = "PLACE_LIKE_NOT_FOUND", message = ex.message ?: "좋아요 기록이 없습니다."))

    @ExceptionHandler(UnsupportedContentTypeException::class)
    fun handleUnsupportedContentType(ex: UnsupportedContentTypeException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(ErrorResponse(code = "UNSUPPORTED_CONTENT_TYPE", message = ex.message ?: "지원하지 않는 파일 형식입니다."))

    @ExceptionHandler(OnboardingCardNotFoundException::class)
    fun handleOnboardingCardNotFound(ex: OnboardingCardNotFoundException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ErrorResponse(code = "ONBOARDING_CARD_NOT_FOUND", message = ex.message ?: "온보딩 카드를 찾을 수 없습니다."))

    @ExceptionHandler(OnboardingCardAlreadySwipedException::class)
    fun handleOnboardingCardAlreadySwiped(ex: OnboardingCardAlreadySwipedException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.CONFLICT)
            .body(ErrorResponse(code = "ONBOARDING_CARD_ALREADY_SWIPED", message = ex.message ?: "이미 스와이프한 카드입니다."))

    @ExceptionHandler(InvalidPhotoReferenceException::class)
    fun handleInvalidPhotoReference(ex: InvalidPhotoReferenceException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(ErrorResponse(code = "INVALID_PHOTO_REFERENCE", message = ex.message ?: "잘못된 photo_reference입니다."))

    @ExceptionHandler(ImageProxyUpstreamException::class)
    fun handleImageProxyUpstream(ex: ImageProxyUpstreamException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.BAD_GATEWAY)
            .body(ErrorResponse(code = "IMAGE_PROXY_UPSTREAM_ERROR", message = ex.message ?: "이미지를 가져오지 못했습니다."))

    @ExceptionHandler(CourseNotFoundException::class)
    fun handleCourseNotFound(ex: CourseNotFoundException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ErrorResponse(code = "COURSE_NOT_FOUND", message = ex.message ?: "코스를 찾을 수 없습니다."))

    @ExceptionHandler(CourseAccessDeniedException::class)
    fun handleCourseAccessDenied(ex: CourseAccessDeniedException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(ErrorResponse(code = "COURSE_ACCESS_DENIED", message = ex.message ?: "본인 코스가 아닙니다."))

    @ExceptionHandler(CourseNotPublicException::class)
    fun handleCourseNotPublic(ex: CourseNotPublicException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(ErrorResponse(code = "COURSE_NOT_PUBLIC", message = ex.message ?: "공개되지 않은 코스입니다."))

    @ExceptionHandler(InvalidCourseSourceException::class)
    fun handleInvalidCourseSource(ex: InvalidCourseSourceException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(ErrorResponse(code = "INVALID_COURSE_SOURCE", message = ex.message ?: "잘못된 source 값입니다."))

    @ExceptionHandler(InvalidCourseDateRangeException::class)
    fun handleInvalidCourseDateRange(ex: InvalidCourseDateRangeException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(ErrorResponse(code = "INVALID_COURSE_DATE_RANGE", message = ex.message ?: "잘못된 날짜 범위입니다."))

    @ExceptionHandler(InvalidCourseTimeRangeException::class)
    fun handleInvalidCourseTimeRange(ex: InvalidCourseTimeRangeException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(ErrorResponse(code = "INVALID_COURSE_TIME_RANGE", message = ex.message ?: "잘못된 시간 범위입니다."))

    @ExceptionHandler(VisitLogNotFoundException::class)
    fun handleVisitLogNotFound(ex: VisitLogNotFoundException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ErrorResponse(code = "VISIT_LOG_NOT_FOUND", message = ex.message ?: "여행 기록을 찾을 수 없습니다."))

    @ExceptionHandler(VisitLogAccessDeniedException::class)
    fun handleVisitLogAccessDenied(ex: VisitLogAccessDeniedException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(ErrorResponse(code = "VISIT_LOG_ACCESS_DENIED", message = ex.message ?: "본인 기록이 아닙니다."))

    @ExceptionHandler(SwipeSessionNotFoundException::class)
    fun handleSwipeSessionNotFound(ex: SwipeSessionNotFoundException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ErrorResponse(code = "SWIPE_SESSION_NOT_FOUND", message = ex.message ?: "스와이프 세션을 찾을 수 없습니다."))

    @ExceptionHandler(SwipeSessionAccessDeniedException::class)
    fun handleSwipeSessionAccessDenied(ex: SwipeSessionAccessDeniedException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(ErrorResponse(code = "SWIPE_SESSION_ACCESS_DENIED", message = ex.message ?: "본인 세션이 아닙니다."))

    // api_1.3.1v.yaml 예시가 code: SESSION_EXPIRED를 고정해뒀음 (SWIPE_SESSION_EXPIRED가 아님)
    @ExceptionHandler(SwipeSessionExpiredException::class)
    fun handleSwipeSessionExpired(ex: SwipeSessionExpiredException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.GONE)
            .body(ErrorResponse(code = "SESSION_EXPIRED", message = ex.message ?: "스와이프 세션이 만료되었습니다."))

    @ExceptionHandler(SwipeCandidateNotFoundException::class)
    fun handleSwipeCandidateNotFound(ex: SwipeCandidateNotFoundException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ErrorResponse(code = "SWIPE_CANDIDATE_NOT_FOUND", message = ex.message ?: "세션의 후보 목록에 없는 장소입니다."))

    @ExceptionHandler(PlaceRecommenderUpstreamException::class)
    fun handlePlaceRecommenderUpstream(ex: PlaceRecommenderUpstreamException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.BAD_GATEWAY)
            .body(ErrorResponse(code = "PLACE_RECOMMENDER_UPSTREAM_ERROR", message = ex.message ?: "장소 추천에 실패했습니다."))

    @ExceptionHandler(CourseOptimizerUpstreamException::class)
    fun handleCourseOptimizerUpstream(ex: CourseOptimizerUpstreamException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.BAD_GATEWAY)
            .body(ErrorResponse(code = "COURSE_OPTIMIZER_UPSTREAM_ERROR", message = ex.message ?: "코스 생성에 실패했습니다."))

    @ExceptionHandler(NotEnoughSwipeCandidatesException::class)
    fun handleNotEnoughSwipeCandidates(ex: NotEnoughSwipeCandidatesException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(ErrorResponse(code = "NOT_ENOUGH_SWIPE_CANDIDATES", message = ex.message ?: "코스를 만들 후보가 부족합니다."))

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleInvalidRequest(ex: MethodArgumentNotValidException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(
                ErrorResponse(
                    code = "INVALID_REQUEST",
                    message = ex.bindingResult.fieldErrors.firstOrNull()?.let { "${it.field}: ${it.defaultMessage}" }
                        ?: "잘못된 요청입니다.",
                )
            )

    // @RequestBody 파싱 실패(필수 필드 누락 등)를 sendError()로 넘기지 않고 여기서 직접 응답해야
    // 서블릿 컨테이너의 /error 내부 포워딩이 Security 인증 체크에 걸려 401로 덮어써지는 걸 막을 수 있음
    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun handleMalformedRequest(ex: HttpMessageNotReadableException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(ErrorResponse(code = "INVALID_REQUEST", message = "요청 본문을 읽을 수 없습니다."))
}
