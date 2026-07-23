package com.dongle.server.user

import com.dongle.server.user.dto.UpdateProfileRequest
import com.dongle.server.user.dto.UserProfileResponse
import jakarta.validation.Valid
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/users")
class UserController(
    private val userService: UserService,
) {
    @GetMapping("/me")
    fun me(authentication: Authentication): UserProfileResponse =
        userService.getProfile(authentication.principal as Long)

    @PatchMapping("/me")
    fun updateMe(
        authentication: Authentication,
        @Valid @RequestBody request: UpdateProfileRequest,
    ): UserProfileResponse = userService.updateProfile(authentication.principal as Long, request)
}
