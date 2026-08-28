package com.dongle.server.user

import com.dongle.server.user.dto.UpdateProfileRequest
import com.dongle.server.user.dto.UserPreferenceTagResponse
import com.dongle.server.user.dto.UserPreferencesResponse
import com.dongle.server.user.dto.UserProfileResponse
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional(readOnly = true)
class UserService(
    private val userRepository: UserRepository,
    private val userPreferenceRepository: UserPreferenceRepository,
) {
    fun getProfile(userId: Long): UserProfileResponse =
        findUser(userId).toResponse()

    fun getPreferences(userId: Long): UserPreferencesResponse =
        UserPreferencesResponse(
            preferences = userPreferenceRepository.findByUserId(userId)
                .map { UserPreferenceTagResponse(tag = it.tag, score = it.score) }
        )

    @Transactional
    fun updateProfile(userId: Long, request: UpdateProfileRequest): UserProfileResponse {
        val user = findUser(userId)
        request.nickname?.let { user.nickname = it }
        request.profileImageUrl?.let { user.profileImageUrl = it }
        return user.toResponse()
    }

    private fun findUser(userId: Long): User =
        userRepository.findById(userId).orElseThrow { UserNotFoundException(userId) }
}

private fun User.toResponse() = UserProfileResponse(
    id = id,
    nickname = nickname,
    profileImageUrl = profileImageUrl,
    oauthProvider = oauthProvider.name,
    hasOnboarded = hasOnboarded,
    createdAt = createdAt,
)
