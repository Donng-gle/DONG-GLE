package com.dongle.server.place

class PlaceAlreadyLikedException(placeId: Long) : RuntimeException("이미 좋아요한 장소입니다. placeId=$placeId")
