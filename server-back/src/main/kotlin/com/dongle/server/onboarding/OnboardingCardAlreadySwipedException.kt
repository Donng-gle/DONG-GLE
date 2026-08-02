package com.dongle.server.onboarding

class OnboardingCardAlreadySwipedException(cardId: Long) :
    RuntimeException("이미 스와이프한 카드입니다. cardId=$cardId")
