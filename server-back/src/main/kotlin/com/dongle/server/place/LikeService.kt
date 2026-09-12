package com.dongle.server.place

import com.dongle.server.user.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional
class LikeService(
    private val placeRepository: PlaceRepository,
    private val placeLikeRepository: PlaceLikeRepository,
    private val userRepository: UserRepository,
) {
    fun like(userId: Long, placeId: Long): Long {
        if (!placeRepository.existsById(placeId)) throw PlaceNotFoundException(placeId)
        if (placeLikeRepository.existsByUserIdAndPlaceId(userId, placeId)) throw PlaceAlreadyLikedException(placeId)

        placeLikeRepository.save(
            PlaceLike(
                user = userRepository.getReferenceById(userId),
                place = placeRepository.getReferenceById(placeId),
            )
        )
        return placeLikeRepository.countByPlaceId(placeId)
    }

    fun unlike(userId: Long, placeId: Long): Long {
        val like = placeLikeRepository.findByUserIdAndPlaceId(userId, placeId)
            ?: throw PlaceLikeNotFoundException(placeId)
        placeLikeRepository.delete(like)
        return placeLikeRepository.countByPlaceId(placeId)
    }
}
