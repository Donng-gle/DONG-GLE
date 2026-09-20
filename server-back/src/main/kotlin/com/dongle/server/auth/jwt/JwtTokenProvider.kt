package com.dongle.server.auth.jwt

import com.dongle.server.common.config.JwtProperties
import io.jsonwebtoken.JwtException
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.springframework.stereotype.Component
import java.time.Instant
import java.util.Date
import java.util.UUID

@Component
class JwtTokenProvider(
    private val jwtProperties: JwtProperties,
) {
    private val key = Keys.hmacShaKeyFor(jwtProperties.secret.toByteArray())

    fun generateAccessToken(userId: Long): String =
        generateToken(userId, jwtProperties.accessTokenExpirySeconds)

    fun generateRefreshToken(userId: Long): String =
        generateToken(userId, jwtProperties.refreshTokenExpirySeconds)

    fun getUserId(token: String): Long = parseClaims(token).subject.toLong()

    fun validate(token: String): Boolean =
        try {
            parseClaims(token)
            true
        } catch (e: JwtException) {
            false
        } catch (e: IllegalArgumentException) {
            false
        }

    private fun generateToken(userId: Long, expirySeconds: Long): String {
        val now = Instant.now()
        return Jwts.builder()
            .subject(userId.toString())
            // iat/exp가 초 단위라 같은 유저에게 같은 초 안에 두 번 발급하면 문자열이 완전히 똑같아짐 —
            // 리프레시 토큰 회전(AuthService.refresh) 도입 후 실제로 겪음: 갱신 직후 재갱신하면 새로
            // 만든 토큰이 방금 지운 토큰과 바이트 단위로 같아서 refresh_token UNIQUE 제약 위반이 남.
            // jti(무작위 UUID)를 넣어 같은 초에 발급해도 항상 다른 토큰이 되도록 함 (2026-09-04 발견/수정)
            .id(UUID.randomUUID().toString())
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(expirySeconds)))
            .signWith(key)
            .compact()
    }

    private fun parseClaims(token: String) =
        Jwts.parser().verifyWith(key).build().parseSignedClaims(token).payload
}
