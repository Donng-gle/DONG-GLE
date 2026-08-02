package com.dongle.server.common

import com.dongle.server.auth.InvalidOAuthCodeException
import com.dongle.server.auth.InvalidRefreshTokenException
import com.dongle.server.onboarding.OnboardingCardAlreadySwipedException
import com.dongle.server.onboarding.OnboardingCardNotFoundException
import com.dongle.server.place.PlaceAlreadyLikedException
import com.dongle.server.place.PlaceLikeNotFoundException
import com.dongle.server.place.PlaceNotFoundException
import com.dongle.server.user.UserNotFoundException
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

    @ExceptionHandler(OnboardingCardNotFoundException::class)
    fun handleOnboardingCardNotFound(ex: OnboardingCardNotFoundException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ErrorResponse(code = "ONBOARDING_CARD_NOT_FOUND", message = ex.message ?: "온보딩 카드를 찾을 수 없습니다."))

    @ExceptionHandler(OnboardingCardAlreadySwipedException::class)
    fun handleOnboardingCardAlreadySwiped(ex: OnboardingCardAlreadySwipedException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.CONFLICT)
            .body(ErrorResponse(code = "ONBOARDING_CARD_ALREADY_SWIPED", message = ex.message ?: "이미 스와이프한 카드입니다."))

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
