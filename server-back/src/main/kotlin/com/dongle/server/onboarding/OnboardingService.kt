package com.dongle.server.onboarding

import com.dongle.server.onboarding.dto.OnboardingCardResponse
import com.dongle.server.onboarding.dto.OnboardingCompleteResponse
import com.dongle.server.onboarding.dto.OnboardingNextResponse
import com.dongle.server.onboarding.dto.OnboardingResetResponse
import com.dongle.server.onboarding.dto.OnboardingStatusResponse
import com.dongle.server.onboarding.dto.OnboardingSwipeRequest
import com.dongle.server.onboarding.dto.OnboardingSwipeResponse
import com.dongle.server.onboarding.dto.UserVectorResponse
import com.dongle.server.user.User
import com.dongle.server.user.UserNotFoundException
import com.dongle.server.user.UserPreference
import com.dongle.server.user.UserPreferenceRepository
import com.dongle.server.user.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Service
@Transactional(readOnly = true)
class OnboardingService(
    private val onboardingCardRepository: OnboardingCardRepository,
    private val onboardingSwipeLogRepository: OnboardingSwipeLogRepository,
    private val userPreferenceRepository: UserPreferenceRepository,
    private val userRepository: UserRepository,
) {
    fun getStatus(userId: Long): OnboardingStatusResponse {
        val logs = onboardingSwipeLogRepository.findByUserIdOrderByCreatedAtDesc(userId)
        val likeCount = logs.count { it.action == OnboardingAction.like }
        val totalSeen = logs.size

        return OnboardingStatusResponse(
            totalSeen = totalSeen,
            likeCount = likeCount,
            dislikeCount = totalSeen - likeCount,
            isConverged = isConverged(totalSeen, likeCount, recentChangeOf(logs)),
            userVector = UserVectorResponse.from(loadUserVector(userId)),
            shownCardIds = logs.map { it.card.id }.sorted(),
        )
    }

    fun getNextCard(userId: Long): OnboardingNextResponse? {
        val logs = onboardingSwipeLogRepository.findByUserIdOrderByCreatedAtDesc(userId)
        val totalSeen = logs.size
        val likeCount = logs.count { it.action == OnboardingAction.like }

        if (totalSeen >= MAX_CARDS || isConverged(totalSeen, likeCount, recentChangeOf(logs))) return null

        val shownIds = logs.map { it.card.id }.toSet()

        if (totalSeen < SEED_COUNT) {
            val nextSeed = onboardingCardRepository.findByIsSeedTrueOrderById().firstOrNull { it.id !in shownIds }
            if (nextSeed != null) {
                return OnboardingNextResponse(nextSeed.toResponse(), CardSelectionStrategy.seed, emptyList())
            }
            // 시드 카드가 부족하면(데이터 미비) 바로 적응형 단계로 대체
        }

        return pickAdaptiveCard(userId, shownIds, likeCount)
    }

    @Transactional
    fun swipe(userId: Long, request: OnboardingSwipeRequest): OnboardingSwipeResponse {
        val cardId = requireNotNull(request.cardId)
        val action = requireNotNull(request.action)

        val priorLogs = onboardingSwipeLogRepository.findByUserIdOrderByCreatedAtDesc(userId)
        if (priorLogs.any { it.card.id == cardId }) throw OnboardingCardAlreadySwipedException(cardId)

        val card = onboardingCardRepository.findById(cardId).orElseThrow { OnboardingCardNotFoundException(cardId) }
        val user = userRepository.getReferenceById(userId)

        val before = loadUserVector(userId)
        val after = before.applySwipe(card.toVector(), action)
        val changeAmount = after.changeAmountFrom(before)

        saveUserVector(user, after)
        val newLog = onboardingSwipeLogRepository.save(
            OnboardingSwipeLog(user = user, card = card, action = action, changeAmount = changeAmount)
        )

        val allLogs = listOf(newLog) + priorLogs
        val totalSeen = allLogs.size
        val likeCount = allLogs.count { it.action == OnboardingAction.like }
        val recentChange = recentChangeOf(allLogs)

        return OnboardingSwipeResponse(
            userVector = UserVectorResponse.from(after),
            totalSeen = totalSeen,
            isConverged = isConverged(totalSeen, likeCount, recentChange),
            recentChange = recentChange,
        )
    }

    @Transactional
    fun complete(userId: Long): OnboardingCompleteResponse {
        val vector = loadUserVector(userId)
        val user = userRepository.findById(userId).orElseThrow { UserNotFoundException(userId) }
        user.hasOnboarded = true

        return OnboardingCompleteResponse(
            userVector = UserVectorResponse.from(vector),
            topTags = vector.topTags(3),
        )
    }

    @Transactional
    fun reset(userId: Long): OnboardingResetResponse {
        val user = userRepository.findById(userId).orElseThrow { UserNotFoundException(userId) }
        onboardingSwipeLogRepository.deleteAllByUserId(userId)
        userPreferenceRepository.deleteAllByUserId(userId)
        user.hasOnboarded = false

        return OnboardingResetResponse(
            userVector = UserVectorResponse.from(EmotionVector()),
            message = "취향 벡터가 초기화되었습니다. 온보딩을 다시 시작해주세요.",
        )
    }

    // 균형(60%) + 탐색(30%) + 랜덤(10%) 혼합 전략 (Onboarding Algo.md v2.0.0)
    private fun pickAdaptiveCard(userId: Long, shownIds: Set<Long>, likeCount: Int): OnboardingNextResponse? {
        val candidates =
            if (shownIds.isEmpty()) onboardingCardRepository.findAll()
            else onboardingCardRepository.findAllExcluding(shownIds)
        if (candidates.isEmpty()) return null

        val userVector = loadUserVector(userId)
        val roll = Math.random()

        return when {
            roll < RANDOM_RATIO -> {
                OnboardingNextResponse(candidates.random().toResponse(), CardSelectionStrategy.random, emptyList())
            }
            roll < RANDOM_RATIO + EXPLORE_RATIO -> {
                // 좋아요 0개면 유사도 기준으로 탐색할 신호가 없어 랜덤으로 대체
                val card = if (likeCount == 0) candidates.random()
                    else candidates.maxByOrNull { it.toVector().cosineSimilarity(userVector) }!!
                OnboardingNextResponse(card.toResponse(), CardSelectionStrategy.explore, emptyList())
            }
            else -> {
                val weakTags = userVector.bottomTags(3)
                val card = candidates.maxByOrNull { candidate ->
                    val vector = candidate.toVector().toMap()
                    weakTags.sumOf { tag -> vector.getValue(tag) }
                }!!
                OnboardingNextResponse(card.toResponse(), CardSelectionStrategy.balance, weakTags)
            }
        }
    }

    private fun loadUserVector(userId: Long): EmotionVector {
        val rows = userPreferenceRepository.findByUserId(userId)
        if (rows.isEmpty()) return EmotionVector()
        return EmotionVector.of(rows.associate { it.tag to it.score })
    }

    private fun saveUserVector(user: User, vector: EmotionVector) {
        val existing = userPreferenceRepository.findByUserId(user.id).associateBy { it.tag }
        vector.toMap().forEach { (tag, score) ->
            val row = existing[tag]
            if (row != null) {
                row.score = score
                row.updatedAt = LocalDateTime.now()
            } else {
                userPreferenceRepository.save(UserPreference(user = user, tag = tag, score = score))
            }
        }
    }

    // 최근 3장 벡터 변화량 평균. 스와이프 기록이 없으면 수렴 아님으로 간주.
    private fun recentChangeOf(logsDesc: List<OnboardingSwipeLog>): Double {
        val recent = logsDesc.take(3)
        if (recent.isEmpty()) return 1.0
        return recent.map { it.changeAmount }.average()
    }

    private fun isConverged(totalSeen: Int, likeCount: Int, recentChange: Double): Boolean =
        totalSeen >= MIN_CARDS_FOR_CONVERGENCE &&
            likeCount >= MIN_LIKES_FOR_CONVERGENCE &&
            recentChange < CONVERGENCE_THRESHOLD

    companion object {
        private const val SEED_COUNT = 7
        private const val MIN_CARDS_FOR_CONVERGENCE = 15
        private const val MAX_CARDS = 25
        private const val MIN_LIKES_FOR_CONVERGENCE = 3
        private const val CONVERGENCE_THRESHOLD = 0.03
        private const val RANDOM_RATIO = 0.10
        private const val EXPLORE_RATIO = 0.30
        // 나머지 0.60 = balance
    }
}

private fun OnboardingCard.toResponse() = OnboardingCardResponse(
    id = id,
    name = displayName,
    imageUrl = imageUrl,
    vector = UserVectorResponse.from(toVector()),
    isSeed = isSeed,
)
