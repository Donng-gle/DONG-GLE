package com.dongle.server.place

class PlaceLikeNotFoundException(placeId: Long) : RuntimeException("좋아요 기록이 없습니다. placeId=$placeId")
