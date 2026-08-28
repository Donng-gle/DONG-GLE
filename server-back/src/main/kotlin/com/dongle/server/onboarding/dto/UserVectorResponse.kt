package com.dongle.server.onboarding.dto

import com.dongle.server.onboarding.EmotionVector

data class UserVectorResponse(
    val relaxing: Double,
    val lively: Double,
    val romantic: Double,
    val local: Double,
    val photogenic: Double,
    val traditional: Double,
    val modern: Double,
) {
    companion object {
        fun from(vector: EmotionVector) = UserVectorResponse(
            relaxing = vector.relaxing,
            lively = vector.lively,
            romantic = vector.romantic,
            local = vector.local,
            photogenic = vector.photogenic,
            traditional = vector.traditional,
            modern = vector.modern,
        )
    }
}
