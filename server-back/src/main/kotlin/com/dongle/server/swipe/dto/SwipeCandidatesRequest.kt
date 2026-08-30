package com.dongle.server.swipe.dto

import com.dongle.server.place.PlaceCategory
import com.dongle.server.swipe.SwipeTransport
import jakarta.validation.constraints.NotNull
import java.time.LocalDate

data class SwipeCandidatesRequest(
    @field:NotNull
    val travelDate: LocalDate? = null,

    @field:NotNull
    val transport: SwipeTransport? = null,

    // 비어있으면 user_preference 상위 태그를 자동 사용 (SwipeService 참고)
    val moodTags: List<String> = emptyList(),

    // 비어있으면 전체 카테고리에서 추천
    val preferredCategories: List<PlaceCategory> = emptyList(),
)
