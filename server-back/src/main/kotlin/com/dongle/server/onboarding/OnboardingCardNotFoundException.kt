package com.dongle.server.onboarding

class OnboardingCardNotFoundException(cardId: Long) : RuntimeException("온보딩 카드를 찾을 수 없습니다. cardId=$cardId")
