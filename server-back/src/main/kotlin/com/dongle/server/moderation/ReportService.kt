package com.dongle.server.moderation

import com.dongle.server.moderation.dto.CreateReportRequest
import com.dongle.server.moderation.dto.ReportResponse
import com.dongle.server.user.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional
class ReportService(
    private val contentReportRepository: ContentReportRepository,
    private val userRepository: UserRepository,
) {
    // 신고 대상(방문 기록/코스)이 실제로 존재하는지는 검증하지 않는다 — 신고 시점과 운영자 확인
    // 시점 사이에 작성자가 콘텐츠를 지웠을 수도 있고, 그것도 운영자에게는 유의미한 신호라 그대로
    // 접수해둔다(이 프로젝트 규모의 최소 구현, decision-log 참고 예정)
    fun create(reporterId: Long, request: CreateReportRequest): ReportResponse {
        val report = contentReportRepository.save(
            ContentReport(
                reporter = userRepository.getReferenceById(reporterId),
                targetType = requireNotNull(request.targetType),
                targetId = requireNotNull(request.targetId),
                reason = requireNotNull(request.reason),
                detail = request.detail?.trim()?.takeIf { it.isNotEmpty() },
            )
        )
        return report.toResponse()
    }

    // 어드민 패널이 없어 role 체크 없이 인증만 요구 — SecurityConfig에 role 개념 자체가 없는
    // 기존 컨벤션과 일관되게, 운영진(팀원)만 URL을 아는 수준으로 최소 구현(2026-09-14)
    @Transactional(readOnly = true)
    fun listPending(): List<ReportResponse> =
        contentReportRepository.findByStatusOrderByCreatedAtAsc(ReportStatus.pending).map { it.toResponse() }
}

private fun ContentReport.toResponse() = ReportResponse(
    id = id,
    targetType = targetType,
    targetId = targetId,
    reason = reason,
    detail = detail,
    status = status,
    createdAt = createdAt,
)
