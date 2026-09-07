package com.dongle.server.auth

import com.dongle.server.auth.dto.GoogleLoginRequest
import com.dongle.server.auth.dto.OAuthLoginRequest
import com.dongle.server.auth.dto.OAuthLoginResponse
import com.dongle.server.auth.dto.RefreshRequest
import com.dongle.server.auth.dto.RefreshResponse
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.net.URI

@RestController
@RequestMapping("/auth")
class AuthController(
    private val authService: AuthService,
) {
    @PostMapping("/oauth/kakao")
    fun loginWithKakao(@Valid @RequestBody request: OAuthLoginRequest): OAuthLoginResponse =
        authService.loginWithKakao(request.code)

    // 카카오 콘솔의 Redirect URI는 https만 받고 앱의 커스텀 스킴(dongle://)을 거부한다
    // (2026-08-27 확인, decision-log 참고). 그래서 이 HTTPS 엔드포인트를 카카오 콘솔에 등록해두고,
    // 카카오가 여기로 보내는 code/error 쿼리스트링을 그대로 dongle:// 커스텀 스킴으로 302 리다이렉트해서
    // 앱한테 다시 넘겨주는 순수 중계 용도로만 쓴다. 실제 로그인 처리(POST /auth/oauth/kakao)와는 무관.
    @GetMapping("/kakao/callback")
    fun kakaoRedirectRelay(request: HttpServletRequest): ResponseEntity<Void> {
        val query = request.queryString
        val location = if (query.isNullOrBlank()) APP_REDIRECT_URI else "$APP_REDIRECT_URI?$query"
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(location)).build()
    }

    @PostMapping("/oauth/google")
    fun loginWithGoogle(@Valid @RequestBody request: GoogleLoginRequest): OAuthLoginResponse =
        authService.loginWithGoogle(request.idToken)

    @PostMapping("/refresh")
    fun refresh(@Valid @RequestBody request: RefreshRequest): RefreshResponse =
        authService.refresh(request.refreshToken)

    @DeleteMapping("/logout")
    fun logout(authentication: Authentication): ResponseEntity<Void> {
        authService.logout(authentication.principal as Long)
        return ResponseEntity.noContent().build()
    }

    companion object {
        // app.json의 expo.scheme("dongle")과 client-front의 makeRedirectUri path("redirect")에 맞춤.
        // "dongle://"처럼 authority가 완전히 비어있으면 카카오 콘솔도, java.net.URI도 거부함(둘 다 확인됨) —
        // path 세그먼트를 하나 붙여야 유효한 URI로 인정됨
        private const val APP_REDIRECT_URI = "dongle://redirect"
    }
}
