package com.dongle.server.place.dto

import java.time.LocalTime

// close_day/close_time이 null이면 open_day 당일 24시간 영업
data class PlaceHoursResponse(
    val openDay: Int,
    val openTime: LocalTime,
    val closeDay: Int?,
    val closeTime: LocalTime?,
)
