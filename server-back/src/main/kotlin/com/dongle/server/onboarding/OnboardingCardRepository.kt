package com.dongle.server.onboarding

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface OnboardingCardRepository : JpaRepository<OnboardingCard, Long> {

    fun findByIsSeedTrueOrderById(): List<OnboardingCard>

    @Query("select c from OnboardingCard c where c.id not in :excludedIds")
    fun findAllExcluding(@Param("excludedIds") excludedIds: Collection<Long>): List<OnboardingCard>
}
