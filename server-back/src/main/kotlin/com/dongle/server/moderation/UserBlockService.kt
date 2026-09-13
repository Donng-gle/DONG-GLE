package com.dongle.server.moderation

import com.dongle.server.moderation.dto.BlockedUserResponse
import com.dongle.server.user.UserNotFoundException
import com.dongle.server.user.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional
class UserBlockService(
    private val userBlockRepository: UserBlockRepository,
    private val userRepository: UserRepository,
) {
    fun block(blockerId: Long, blockedUserId: Long) {
        if (blockerId == blockedUserId) throw SelfBlockNotAllowedException()
        if (!userRepository.existsById(blockedUserId)) throw UserNotFoundException(blockedUserId)
        if (userBlockRepository.existsByBlockerIdAndBlockedId(blockerId, blockedUserId)) {
            throw UserAlreadyBlockedException(blockedUserId)
        }

        userBlockRepository.save(
            UserBlock(
                blocker = userRepository.getReferenceById(blockerId),
                blocked = userRepository.getReferenceById(blockedUserId),
            )
        )
    }

    fun unblock(blockerId: Long, blockedUserId: Long) {
        val block = userBlockRepository.findByBlockerIdAndBlockedId(blockerId, blockedUserId)
            ?: throw UserBlockNotFoundException(blockedUserId)
        userBlockRepository.delete(block)
    }

    @Transactional(readOnly = true)
    fun listBlocked(blockerId: Long): List<BlockedUserResponse> =
        userBlockRepository.findByBlockerIdOrderByCreatedAtDesc(blockerId).map {
            BlockedUserResponse(
                userId = it.blocked.id,
                nickname = it.blocked.nickname,
                profileImageUrl = it.blocked.profileImageUrl,
                createdAt = it.createdAt,
            )
        }

    // ExploreService/VisitLogService가 후보 목록에서 차단한 유저를 걸러낼 때 씀
    @Transactional(readOnly = true)
    fun blockedUserIds(blockerId: Long): Set<Long> = userBlockRepository.findBlockedUserIds(blockerId)
}
