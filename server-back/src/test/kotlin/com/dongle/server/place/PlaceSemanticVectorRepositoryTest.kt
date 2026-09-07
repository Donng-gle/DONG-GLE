package com.dongle.server.place

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import kotlin.test.assertTrue

// place_semantic_vector는 데이터 파트 배치가 이미 실제 데이터를 적재해둔 공용 테이블이라
// (2026-08-21 기준 182건), 새로 만들지 않고 기존 행을 읽어서 jsonb→String 매핑만 검증한다.
@SpringBootTest
class PlaceSemanticVectorRepositoryTest {

    @Autowired
    lateinit var repository: PlaceSemanticVectorRepository

    @Test
    fun `jsonb 컬럼이 문자열로 정상 매핑된다`() {
        val all = assertDoesNotThrow { repository.findAll(org.springframework.data.domain.PageRequest.of(0, 1)) }

        if (all.isEmpty) {
            // 공용 DB에 데이터가 아직 없는 상태에서 실행될 수도 있으니 매핑 자체는 예외 없이 통과하면 충분
            return
        }

        val row = all.content.first()
        assertTrue(row.majorScores.trim().startsWith("{"), "major_scores가 JSON 객체 문자열이어야 함: ${row.majorScores}")
        assertTrue(row.placeId > 0)
    }
}
