import { apiClient } from './client';

// 신고 사유 4종 — 앱스토어 심사 가이드라인 1.2 대응(2026-09-14, 사용자 확정 스펙).
// server ReportReason enum과 1:1 매칭
export type ReportReason = 'inappropriate' | 'spam' | 'abuse' | 'other';
export type ReportTargetType = 'visit_log' | 'course';
export type ReportStatus = 'pending' | 'reviewed' | 'rejected';

export interface CreateReportRequest {
  target_type: ReportTargetType;
  target_id: number;
  reason: ReportReason;
  detail?: string;
}

export interface Report {
  id: number;
  target_type: ReportTargetType;
  target_id: number;
  reason: ReportReason;
  detail: string | null;
  status: ReportStatus;
  created_at: string;
}

export interface BlockedUser {
  user_id: number;
  nickname: string;
  profile_image_url: string | null;
  created_at: string;
}

export interface BlockedUsersResponse {
  users: BlockedUser[];
}

export const moderationApi = {
  report: (request: CreateReportRequest) => apiClient.post<Report>('/reports', request, true),

  blockUser: (blockedUserId: number) =>
    apiClient.post<void>('/users/me/blocks', { blocked_user_id: blockedUserId }, true),

  unblockUser: (userId: number) => apiClient.delete<void>(`/users/me/blocks/${userId}`, true),

  listBlockedUsers: () => apiClient.get<BlockedUsersResponse>('/users/me/blocks', true),
};
