package com.dongle.server.visitlog

import com.dongle.server.place.Place
import com.dongle.server.user.User
import jakarta.persistence.CascadeType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.OneToMany
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "visit_log")
class VisitLog(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    val user: User,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "place_id", nullable = false)
    val place: Place,

    @Column(name = "photo_url")
    var photoUrl: String? = null,

    // Figma "메인 페이지-나의 일지-기록하기"(593:12613) 시안엔 사진/한줄리뷰와 별개로 짧은 제목
    // 입력칸이 있어서 추가(2026-09-05 결정, decision-log 참고). one_line은 계속 "설명" 역할
    @Column(name = "title")
    var title: String? = null,

    @Column(name = "one_line")
    var oneLine: String? = null,

    // 같은 시안의 "날씨를 입력해주세요" 입력칸 그대로 — 별도 enum/코드값 없이 사용자가 입력한
    // 문자열을 그대로 저장(시안에 선택지 목록이 없어서 자유 입력으로 처리, 2026-09-05 결정)
    @Column(name = "weather")
    var weather: String? = null,

    // 1~5, 선택 입력. DB CHECK(rating BETWEEN 1 AND 5)로도 강제하지만 요청 단계에서
    // @Min/@Max로 먼저 막아서 더 친절한 400 에러를 줌(VisitLogCreateRequest/VisitLogUpdateRequest 참고)
    @Column(name = "rating")
    var rating: Int? = null,

    @Column(name = "is_public", nullable = false)
    var isPublic: Boolean = true,

    @Column(name = "visited_at", nullable = false)
    var visitedAt: LocalDateTime = LocalDateTime.now(),

    @OneToMany(mappedBy = "visitLog", fetch = FetchType.LAZY, cascade = [CascadeType.ALL], orphanRemoval = true)
    val emotionTags: MutableList<LogEmotionTag> = mutableListOf(),
)
