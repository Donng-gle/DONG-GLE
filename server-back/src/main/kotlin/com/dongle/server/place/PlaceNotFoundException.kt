package com.dongle.server.place

class PlaceNotFoundException(placeId: Long) : RuntimeException("장소를 찾을 수 없습니다. id=$placeId")
