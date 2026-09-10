package com.dongle.server.course.dto

data class CoursePlaceItemResponse(
    val placeId: Long,
    val name: String,
    val visitOrder: Int,
    val plannedTime: String?,
    val lat: Double?,
    val lng: Double?,
    val mainImageUrl: String?,
    // 구글맵 Directions 연동 전까지는 항상 null (스프린트3 스코프 외, TODO)
    val distanceFromPrevKm: Double?,
    val durationFromPrevMin: Int?,
    // 여러 날 코스 지원(2026-09-06 결정, decision-log 참고) — "직접 코스 만들기"뿐 아니라
    // AI 코스 생성(POST /courses/generate)도 2026-09-10부터 endDate를 주면 날짜별로 채워서 줌
    val visitDate: String?,
    // 장소 카드 카테고리 라벨(2026-09-11 추가, 프론트 요청 — Figma 시안엔 카테고리 텍스트가 있는데
    // 이 필드가 없어서 생략돼있었음). PLACE.category 그대로(관광지/식당/카페/액티비티/문화공간/
    // 축제행사, PlaceListItemResponse와 동일 값) — Figma 목업 텍스트("관광명소" 등)는 디자인
    // 목업용 예시고 실제 서비스 카테고리 6종과 안 맞아서 새로 지어내지 않고 기존 enum 그대로 노출.
    // generate()에서 course_optimizer가 돌려준 placeId가 요청 풀에 없는 예외 상황(현재 코드상
    // place?.id 등 다른 필드도 이미 이 경우를 대비해 nullable로 처리)엔 알 수 없어서 null
    val category: String?,
)
