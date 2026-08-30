import { apiClient } from './client';
import { PaginationMeta } from './place';

export interface VisitLogCreateRequest {
  // 사진 첨부는 expo-image-picker 등 피커 라이브러리 도입 후 연결 예정 — 필드 자체는 옵셔널이라
  // 사진 없이 한줄리뷰만으로도 기록 작성이 가능함 (server VisitLogCreateRequest.kt 참고)
  photo_url?: string;
  one_line?: string; // 최대 100자
  visited_at?: string; // ISO datetime, 생략 시 서버가 현재 시각 사용 (VisitLogService 참고)
}

export interface VisitLogUpdateRequest {
  one_line?: string;
  visited_at?: string;
}

export interface VisitLogDetail {
  id: number;
  place_id: number;
  place_name: string;
  photo_url: string | null;
  one_line: string | null;
  visited_at: string;
  // AI 감성 태그 자동 부여 미연동 상태라 당분간 항상 빈 배열 (decision-log 2026-08-30 참고)
  tags: string[];
}

export interface VisitLogSummary {
  id: number;
  photo_url: string | null;
  one_line: string | null;
  visited_at: string;
  tags: string[];
}

export interface VisitLogMapItem {
  id: number;
  place_id: number;
  place_name: string;
  lat: number | null;
  lng: number | null;
  photo_url: string | null;
  one_line: string | null;
  visited_at: string;
  tags: string[];
}

export interface MyLogsResponse {
  logs: VisitLogMapItem[];
  meta: PaginationMeta;
}

export interface PlaceLogsResponse {
  logs: VisitLogSummary[];
  meta: PaginationMeta;
}

export const visitLogApi = {
  create: (placeId: number, request: VisitLogCreateRequest) =>
    apiClient.post<VisitLogDetail>(`/places/${placeId}/logs`, request, true),

  myLogs: (page = 1, size = 50) => apiClient.get<MyLogsResponse>(`/users/me/logs?page=${page}&size=${size}`, true),

  // 비인증 허용 — 장소 상세 화면에서 누구나 볼 수 있음
  logsForPlace: (placeId: number, page = 1, size = 20) =>
    apiClient.get<PlaceLogsResponse>(`/places/${placeId}/logs?page=${page}&size=${size}`),

  getDetail: (logId: number) => apiClient.get<VisitLogDetail>(`/logs/${logId}`, true),

  update: (logId: number, request: VisitLogUpdateRequest) =>
    apiClient.patch<VisitLogDetail>(`/logs/${logId}`, request, true),

  remove: (logId: number) => apiClient.delete<void>(`/logs/${logId}`, true),
};
