package com.dongle.server.visitlog

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface LogEmotionTagRepository : JpaRepository<LogEmotionTag, Long> {

    // 장소의 "누적 방문 로그 감성 태그" 상위 태그를 조회할 때 씀 (PlaceService.resolveTags 참고).
    // 예전엔 place_emotion_tag(place_id, tag, count) 테이블을 증감시켜가며 유지했는데, AI가
    // log_emotion_tag에 직접 배치로 적재하는 경로가 생기면서 그 증감 로직을 AI 쪽에서도 같이
    // 해줘야 하는지 애매해졌음 — 아예 카운트를 저장하지 않고 조회 시점에 집계하는 쪽으로 바꿔서
    // 동기화 문제 자체를 없앰 (2026-09-02 결정, decision-log 참고)
    @Query(
        """
        SELECT let.tag AS tag, COUNT(let) AS count
        FROM LogEmotionTag let
        WHERE let.visitLog.place.id = :placeId
        GROUP BY let.tag
        ORDER BY COUNT(let) DESC
        """,
    )
    fun countTagsByPlaceId(@Param("placeId") placeId: Long): List<PlaceTagCount>
}

// getXxx() 대신 Kotlin val 프로퍼티로 선언 — 바이트코드상 getter는 동일해서 Spring Data 프록시 생성엔
// 영향 없지만, fun getXxx() 형태로 두면 같은 모듈(Kotlin) 안의 다른 코드에서 .tag로 접근이 안 됨
// (getter → 프로퍼티 합성은 Java 상호운용 전용 기능이라 순수 Kotlin 간에는 적용 안 됨)
interface PlaceTagCount {
    val tag: String
    val count: Long
}
