package com.dongle.server.common

import com.dongle.server.place.PlaceNotFoundException
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class GlobalExceptionHandler {

    @ExceptionHandler(PlaceNotFoundException::class)
    fun handlePlaceNotFound(ex: PlaceNotFoundException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ErrorResponse(code = "PLACE_NOT_FOUND", message = ex.message ?: "장소를 찾을 수 없습니다."))
}
