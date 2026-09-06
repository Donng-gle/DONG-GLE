import { apiClient } from './client';
import { PaginationMeta } from './place';

export interface VisitLogCreateRequest {
  // 여러 장 지원(2026-09-06 결정, decision-log 참고) — 목록 순서 그대로 sort_order로 저장됨.
  // 사진 없이 한줄리뷰만으로도 기록 작성이 가능해서 옵셔널 (server VisitLogCreateRequest.kt 참고)
  photo_urls?: string[];
  title?: string; // 최대 50자 (2026-09-05 추가 — Figma "메인 페이지-나의 일지-기록하기" 시안, decision-log 참고)
  one_line?: string; // 최대 100자
  weather?: string; // 최대 20자, 자유 입력 텍스트 (2026-09-05 추가, decision-log 참고)
  rating?: number; // 1~5, 선택 입력 (2026-09-05 추가, decision-log 참고)
  visited_at?: string; // ISO datetime, 생략 시 서버가 현재 시각 사용 (VisitLogService 참고)
}

export interface VisitLogUpdateRequest {
  title?: string;
  one_line?: string;
  weather?: string;
  // one_line/title/weather와 달리 rating은 빈 값으로 "지우기"가 안 됨 — 값을 보내면 갱신,
  // 생략하면 기존 값 유지 (server VisitLogUpdateRequest.kt 참고)
  rating?: number;
  visited_at?: string;
}

export interface VisitLogDetail {
  id: number;
  place_id: number;
  place_name: string;
  photo_urls: string[]; // 여러 장 지원(2026-09-06 결정, decision-log 참고). 없으면 빈 배열
  title: string | null;
  one_line: string | null;
  weather: string | null;
  rating: number | null; // 1~5, 선택 입력이라 없을 수 있음
  visited_at: string;
  // AI 감성 태그 자동 부여 미연동 상태라 당분간 항상 빈 배열 (decision-log 2026-08-30 참고)
  tags: string[];
}

export interface VisitLogSummary {
  id: number;
  photo_urls: string[]; // 여러 장 지원(2026-09-06 결정, decision-log 참고). 없으면 빈 배열
  title: string | null;
  one_line: string | null;
  weather: string | null;
  rating: number | null;
  visited_at: string;
  tags: string[];
}

export interface VisitLogMapItem {
  id: number;
  place_id: number;
  place_name: string;
  lat: number | null;
  lng: number | null;
  photo_urls: string[]; // 여러 장 지원(2026-09-06 결정, decision-log 참고). 없으면 빈 배열
  title: string | null;
  one_line: string | null;
  weather: string | null;
  rating: number | null;
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
