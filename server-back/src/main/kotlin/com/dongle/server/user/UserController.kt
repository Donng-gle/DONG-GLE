package com.dongle.server.user

import com.dongle.server.user.dto.UserProfileResponse
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/users")
class UserController(
    private val userRepository: UserRepository,
) {
    @GetMapping("/me")
    fun me(authentication: Authentication): UserProfileResponse {
        val userId = authentication.principal as Long
        val user = userRepository.findById(userId).orElseThrow { UserNotFoundException(userId) }

        return UserProfileResponse(
            id = user.id,
            nickname = user.nickname,
            profileImageUrl = user.profileImageUrl,
            oauthProvider = user.oauthProvider.name,
            hasOnboarded = user.hasOnboarded,
            createdAt = user.createdAt,
        )
    }
}
