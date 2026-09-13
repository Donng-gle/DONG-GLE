package com.dongle.server.moderation

import com.dongle.server.moderation.dto.BlockUserRequest
import com.dongle.server.moderation.dto.BlockedUsersResponse
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

// 앱스토어 심사 가이드라인 1.2(User Generated Content) 대응 — 사용자 차단(2026-09-14 도입)
@RestController
@RequestMapping("/users/me/blocks")
class UserBlockController(
    private val userBlockService: UserBlockService,
) {
    @PostMapping
    fun block(authentication: Authentication, @Valid @RequestBody request: BlockUserRequest): ResponseEntity<Unit> {
        userBlockService.block(authentication.userId(), requireNotNull(request.blockedUserId))
        return ResponseEntity.noContent().build()
    }

    @DeleteMapping("/{userId}")
    fun unblock(authentication: Authentication, @PathVariable userId: Long): ResponseEntity<Unit> {
        userBlockService.unblock(authentication.userId(), userId)
        return ResponseEntity.noContent().build()
    }

    @GetMapping
    fun list(authentication: Authentication): BlockedUsersResponse =
        BlockedUsersResponse(users = userBlockService.listBlocked(authentication.userId()))
}

private fun Authentication.userId(): Long = principal as Long
