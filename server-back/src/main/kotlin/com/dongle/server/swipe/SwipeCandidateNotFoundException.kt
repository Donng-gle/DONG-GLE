package com.dongle.server.swipe

class SwipeCandidateNotFoundException(sessionId: String, placeId: Long) :
    RuntimeException("세션의 후보 목록에 없는 장소입니다. sessionId=$sessionId, placeId=$placeId")
