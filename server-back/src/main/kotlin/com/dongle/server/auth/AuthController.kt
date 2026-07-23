package com.dongle.server.auth

import com.dongle.server.auth.dto.OAuthLoginRequest
import com.dongle.server.auth.dto.OAuthLoginResponse
import com.dongle.server.auth.dto.RefreshRequest
import com.dongle.server.auth.dto.RefreshResponse
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/auth")
class AuthController(
    private val authService: AuthService,
) {
    @PostMapping("/oauth/kakao")
    fun loginWithKakao(@Valid @RequestBody request: OAuthLoginRequest): OAuthLoginResponse =
        authService.loginWithKakao(request.code)

    @PostMapping("/oauth/google")
    fun loginWithGoogle(@Valid @RequestBody request: OAuthLoginRequest): OAuthLoginResponse =
        authService.loginWithGoogle(request.code)

    @PostMapping("/refresh")
    fun refresh(@Valid @RequestBody request: RefreshRequest): RefreshResponse =
        authService.refresh(request.refreshToken)

    @DeleteMapping("/logout")
    fun logout(authentication: Authentication): ResponseEntity<Void> {
        authService.logout(authentication.principal as Long)
        return ResponseEntity.noContent().build()
    }
}
