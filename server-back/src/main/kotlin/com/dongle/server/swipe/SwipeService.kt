package com.dongle.server.swipe

import com.dongle.server.onboarding.EmotionVector
import com.dongle.server.onboarding.OnboardingAction
import com.dongle.server.place.PlaceCategory
import com.dongle.server.place.PlaceRepository
import com.dongle.server.place.PlaceSemanticVector
import com.dongle.server.place.PlaceService
import com.dongle.server.recommend.PlaceRecommenderClient
import com.dongle.server.recommend.PreferenceTagItem
import com.dongle.server.recommend.RecommendRequest
import com.dongle.server.recommend.RecommendationItem
import com.dongle.server.swipe.dto.SwipeCandidateResponse
import com.dongle.server.swipe.dto.SwipeCandidatesRequest
import com.dongle.server.swipe.dto.SwipeCandidatesResponse
import com.dongle.server.swipe.dto.SwipeResultRequest
import com.dongle.server.swipe.dto.SwipeSessionDetailResponse
import com.dongle.server.swipe.dto.SwipedResultItemResponse
import com.dongle.server.user.User
import com.dongle.server.user.UserPreference
import com.dongle.server.user.UserPreferenceRepository
import com.dongle.server.user.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper
import java.time.LocalDateTime
import java.util.UUID
import kotlin.math.ceil

@Service
@Transactional(readOnly = true)
class SwipeService(
    private val swipeSessionRepository: SwipeSessionRepository,
    private val swipeSessionCandidateRepository: SwipeSessionCandidateRepository,
    private val placeRepository: PlaceRepository,
    private val placeService: PlaceService,
    private val placeRecommenderClient: PlaceRecommenderClient,
    private val userRepository: UserRepository,
    private val userPreferenceRepository: UserPreferenceRepository,
    private val objectMapper: ObjectMapper,
) {
    @Transactional
    fun createSession(userId: Long, request: SwipeCandidatesRequest): SwipeCandidatesResponse {
        val travelDate = requireNotNull(request.travelDate)
        val transport = requireNotNull(request.transport)

        val preferences = resolvePreferences(userId, request.moodTags)
        val recommendations = fetchCandidates(preferences, request.preferredCategories)

        val placeIds = recommendations.mapNotNull { it.placeId.toLongOrNull() }
        val placesById = placeRepository.findAllById(placeIds).associateBy { it.id }
        val vectors = placeService.semanticVectorsByPlaceId(placeIds)

        val user = userRepository.getReferenceById(userId)
        val session = swipeSessionRepository.save(
            SwipeSession(
                id = generateSessionId(),
                user = user,
                travelDate = travelDate,
                transport = transport,
                expiresAt = LocalDateTime.now().plusHours(SESSION_TTL_HOURS),
            )
        )

        var sortOrder = 0
        val candidates = recommendations.mapNotNull { item ->
            val place = placesById[item.placeId.toLongOrNull()] ?: return@mapNotNull null
            SwipeSessionCandidate(session = session, place = place, sortOrder = sortOrder++)
        }
        swipeSessionCandidateRepository.saveAll(candidates)

        return SwipeCandidatesResponse(
            sessionId = session.id,
            expiresAt = session.expiresAt,
            candidates = candidates.map { it.toResponse(vectors[it.place.id]) },
        )
    }

    fun getSession(userId: Long, sessionId: String): SwipeSessionDetailResponse {
        val session = requireOwnedActiveSession(userId, sessionId)
        val candidates = swipeSessionCandidateRepository.findBySessionIdOrderBySortOrder(sessionId)
        val vectors = placeService.semanticVectorsByPlaceId(candidates.map { it.place.id })

        return SwipeSessionDetailResponse(
            sessionId = session.id,
            expiresAt = session.expiresAt,
            travelDate = session.travelDate,
            transport = session.transport,
            candidates = candidates.filter { it.action == null }.map { it.toResponse(vectors[it.place.id]) },
            swipedResults = candidates.filter { it.action != null }
                .map { SwipedResultItemResponse(placeId = it.place.id, action = it.action!!) },
        )
    }

    // 스와이프 결과를 두 곳에 반영: (1) 후보 카드에 action 기록 (2) like/must는 벡터를 강화, skip은 약화
    // — 온보딩과 동일한 상대적 업데이트 공식(EmotionVector.applySwipe)을 그대로 재사용함.
    // 다만 이 학습률(0.40/0.25)은 온보딩 수렴 알고리즘(v2.0.0)에 맞춰 튜닝된 값이라, 스와이프 세션 결과에도
    // 그대로 쓰는 게 최선인지는 검증된 바 없음 — 우선 합리적 기본값으로 재사용, 필요시 별도 값으로 분리 검토
    @Transactional
    fun submitResults(userId: Long, sessionId: String, request: SwipeResultRequest) {
        requireOwnedActiveSession(userId, sessionId)

        val candidatesByPlaceId =
            swipeSessionCandidateRepository.findBySessionIdOrderBySortOrder(sessionId).associateBy { it.place.id }
        val placeIds = request.swipes.mapNotNull { it.placeId }
        val vectors = placeService.semanticVectorsByPlaceId(placeIds)

        var vector = loadUserVector(userId)
        val now = LocalDateTime.now()

        request.swipes.forEach { swipeItem ->
            val placeId = requireNotNull(swipeItem.placeId)
            val action = requireNotNull(swipeItem.action)
            val candidate = candidatesByPlaceId[placeId] ?: throw SwipeCandidateNotFoundException(sessionId, placeId)

            candidate.action = action
            candidate.swipedAt = now

            val placeVector = vectors[placeId]?.let { it.toEmotionVectorOrNull() } ?: return@forEach
            val onboardingAction = if (action == SwipeAction.skip) OnboardingAction.dislike else OnboardingAction.like
            vector = vector.applySwipe(placeVector, onboardingAction)
        }

        saveUserVector(userRepository.getReferenceById(userId), vector)
    }

    // CourseService.generate()(/courses/generate)가 재사용 — 세션 소유권/만료 검증 후 like/must로
    // 표시된 후보만 반환한다. must 강제 포함은 course_optimizer에 그런 개념이 없어서 지원 불가 —
    // 대신 후보 풀 자체를 이 목록으로 좁혀서 "가능하면 전부 포함"에 가깝게 근사한다 (decision-log 참고)
    fun likedOrMustCandidates(userId: Long, sessionId: String): List<SwipeSessionCandidate> {
        requireOwnedActiveSession(userId, sessionId)
        return swipeSessionCandidateRepository.findBySessionIdOrderBySortOrder(sessionId)
            .filter { it.action == SwipeAction.like || it.action == SwipeAction.must }
    }

    private fun requireOwnedActiveSession(userId: Long, sessionId: String): SwipeSession {
        val session = swipeSessionRepository.findById(sessionId).orElseThrow { SwipeSessionNotFoundException(sessionId) }
        if (session.user.id != userId) throw SwipeSessionAccessDeniedException()
        if (session.expiresAt.isBefore(LocalDateTime.now())) throw SwipeSessionExpiredException()
        return session
    }

    // mood_tags를 직접 입력했으면 그 태그들을 강하게 반영, 아니면 user_preference를 그대로 사용,
    // 둘 다 없으면(미온보딩 + mood_tags 미입력) 중립(0.5 균등) 벡터로 폴백 — 완전히 취향 신호가 없어도
    // Qdrant 유사도 + hidden_score만으로 추천이 동작하도록 함
    private fun resolvePreferences(userId: Long, moodTags: List<String>): List<PreferenceTagItem> {
        if (moodTags.isNotEmpty()) {
            val matched = moodTags.filter { it in EmotionVector.TAGS }.map { PreferenceTagItem(tag = it, score = MOOD_TAG_SCORE) }
            if (matched.isNotEmpty()) return matched
        }
        val rows = userPreferenceRepository.findByUserId(userId)
        if (rows.isNotEmpty()) return rows.map { PreferenceTagItem(tag = it.tag, score = it.score) }
        return EmotionVector.TAGS.map { PreferenceTagItem(tag = it, score = 0.5) }
    }

    // preferred_categories가 여러 개면 카테고리별로 나눠 호출 후 점수순으로 합쳐 상한만큼 자른다.
    // place_recommender API가 category를 단일 문자열로만 받기 때문 (ai/place_recommender/models.py 참고)
    private fun fetchCandidates(
        preferences: List<PreferenceTagItem>,
        categories: List<PlaceCategory>,
    ): List<RecommendationItem> {
        if (categories.isEmpty()) {
            return placeRecommenderClient.recommend(
                RecommendRequest(preferences = preferences, topN = SWIPE_CANDIDATE_COUNT)
            ).recommendations
        }

        val perCategory = ceil(SWIPE_CANDIDATE_COUNT.toDouble() / categories.size).toInt()
        return categories
            .flatMap { category ->
                placeRecommenderClient.recommend(
                    RecommendRequest(preferences = preferences, topN = perCategory, category = category.name)
                ).recommendations
            }
            .distinctBy { it.placeId }
            .sortedByDescending { it.recommendationScore }
            .take(SWIPE_CANDIDATE_COUNT)
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

    private fun PlaceSemanticVector.toEmotionVectorOrNull(): EmotionVector? =
        try {
            val node = objectMapper.readTree(majorScores)
            EmotionVector.of(EmotionVector.TAGS.associateWith { tag -> node.get(tag)?.asDouble() ?: 0.5 })
        } catch (e: Exception) {
            null
        }

    private fun SwipeSessionCandidate.toResponse(vector: PlaceSemanticVector?) = place.let {
        SwipeCandidateResponse(
            placeId = it.id,
            name = it.name,
            mainImageUrl = it.mainImageUrl,
            category = it.category.name,
            tags = placeService.displayTags(it, vector),
        )
    }

    private fun generateSessionId(): String = "swipe_session_" + UUID.randomUUID()

    companion object {
        private const val SESSION_TTL_HOURS = 24L
        private const val SWIPE_CANDIDATE_COUNT = 20
        private const val MOOD_TAG_SCORE = 0.9
    }
}
