package com.dongle.server.onboarding

import com.dongle.server.onboarding.dto.TagItemResponse

// 7개 감성 태그 기준 목록 (SSOT). server-back/Onboarding Algo.md 2장 참고.
// 별도 마스터 테이블 없이 고정 목록으로 관리 — 태그셋 자체가 이미 팀 확정 사항(decision-log)이라 자주 안 바뀜.
object TagCatalog {
    val TAGS: List<TagItemResponse> = listOf(
        TagItemResponse(
            tag = "relaxing",
            label = "Relaxing",
            description = "여유, 힐링, 자연, 조용함",
            criteria = listOf("한적함 있음", "조용한 분위기 있음", "개방감 있음", "자연 요소 있음", "오래 머물고 싶은 분위기 있음"),
        ),
        TagItemResponse(
            tag = "lively",
            label = "Lively",
            description = "활기, 시장, 축제, 북적임",
            criteria = listOf("사람 밀집도 높음", "활동적인 분위기 있음", "상업적 활기 있음", "축제·행사 분위기 있음", "에너지 있는 분위기 있음"),
        ),
        TagItemResponse(
            tag = "romantic",
            label = "Romantic",
            description = "야경, 데이트, 감성",
            criteria = listOf("감성적인 조명 있음", "따뜻한 색감 있음", "아늑한 분위기 있음", "감성적인 연출 요소 있음", "특별한 추억을 만들고 싶은 분위기 있음"),
        ),
        TagItemResponse(
            tag = "local",
            label = "Local",
            description = "동네감성, 골목, 숨은명소",
            criteria = listOf("지역 고유의 분위기 있음", "생활감 있는 공간 있음", "지역 문화 요소 있음", "지역만의 개성 있음", "소박한 분위기 있음"),
        ),
        TagItemResponse(
            tag = "photogenic",
            label = "Photogenic",
            description = "사진 찍기 좋은 분위기",
            criteria = listOf("좋은 사진 구도 있음", "아름다운 배경 있음", "매력적인 색감·조명 있음", "시선을 끄는 포인트 있음", "사진으로 남기고 싶은 장면 있음"),
        ),
        TagItemResponse(
            tag = "traditional",
            label = "Traditional",
            description = "전통적인, 역사적인, 한국적인 감성",
            criteria = listOf("전통적인 분위기 있음", "역사적인 분위기 있음", "한국적인 감성 있음", "고즈넉한 분위기 있음", "문화유산적인 분위기 있음"),
        ),
        TagItemResponse(
            tag = "modern",
            label = "Modern",
            description = "현대적인, 세련된, 트렌디한 분위기",
            criteria = listOf("현대적인 분위기 있음", "도시적인 분위기 있음", "세련된 분위기 있음", "트렌디한 분위기 있음", "감각적인 분위기 있음"),
        ),
    )
}
