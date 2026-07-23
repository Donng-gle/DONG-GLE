package com.dongle.server.auth.jwt

import com.dongle.server.common.config.JwtProperties
import io.jsonwebtoken.JwtException
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.springframework.stereotype.Component
import java.time.Instant
import java.util.Date

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
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(expirySeconds)))
            .signWith(key)
            .compact()
    }

    private fun parseClaims(token: String) =
        Jwts.parser().verifyWith(key).build().parseSignedClaims(token).payload
}
