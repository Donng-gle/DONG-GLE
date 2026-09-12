import { apiClient } from './client';
import { PaginationMeta } from './place';

// 사진 1장 + 캡션(선택). 사진별 캡션 지원(2026-09-07 결정, decision-log 참고) — VisitLog 자신의
// 응답(Detail/Summary/MapItem)과 explore의 SimilarLogItem이 공통으로 사용. 이전엔 URL 문자열이었음
export interface VisitLogPhoto {
  url: string;
  caption: string | null;
}

export interface VisitLogCreateRequest {
  // 여러 장 지원(2026-09-06 결정)+사진별 캡션(2026-09-07 결정, decision-log 참고) — 목록 순서
  // 그대로 sort_order로 저장됨. 사진 없이 한줄리뷰만으로도 기록 작성이 가능해서 옵셔널
  // (server VisitLogCreateRequest.kt 참고)
  photos?: { url: string; caption?: string }[];
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
  // 사진/장소 수정 지원(2026-09-12 추가, server 동일 날짜 커밋 참고). photos는 부분 수정이 아니라
  // "보낸 목록으로 완전히 교체" — 생략하면 기존 사진 유지, 빈 배열([])을 보내면 전부 삭제
  photos?: { url: string; caption?: string }[];
  place_id?: number;
}

export interface VisitLogDetail {
  id: number;
  place_id: number;
  place_name: string;
  // 코스 단위 기록(장소 2개 이상)일 때만 값 있음 (2026-09-08 추가, decision-log 참고)
  course_id: number | null;
  course_title: string | null;
  photos: VisitLogPhoto[]; // 여러 장 지원(2026-09-06)+사진별 캡션(2026-09-07, decision-log 참고). 없으면 빈 배열
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
  photos: VisitLogPhoto[]; // 여러 장 지원(2026-09-06)+사진별 캡션(2026-09-07, decision-log 참고). 없으면 빈 배열
  title: string | null;
  one_line: string | null;
  weather: string | null;
  rating: number | null;
  visited_at: string;
  tags: string[];
  // 관광지 상세 페이지 리뷰 카드용 작성자 정보 (2026-09-09 추가, decision-log 참고)
  nickname: string;
  profile_image_url: string | null;
}

export interface VisitLogMapItem {
  id: number;
  place_id: number;
  place_name: string;
  // 코스 단위 기록(장소 2개 이상)일 때만 값 있음 — 나의 일지 화면이 같은 course_id끼리
  // 묶어서 코스 카드로 보여줌 (2026-09-08 추가, decision-log 참고)
  course_id: number | null;
  course_title: string | null;
  lat: number | null;
  lng: number | null;
  photos: VisitLogPhoto[]; // 여러 장 지원(2026-09-06)+사진별 캡션(2026-09-07, decision-log 참고). 없으면 빈 배열
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

// 나의 일지 "기록하기"에서 장소를 2개 이상 골랐을 때 — 장소마다 각각 사진/한줄리뷰/별점/날씨를
// 입력받고, 서버가 이 목록을 courseTitle과 함께 코스(source=journal)로 묶어서 저장한다
// (2026-09-08 결정, decision-log 참고). 장소 1개면 기존 visitLogApi.create를 그대로 씀
export interface VisitLogCoursePlaceCreateRequest {
  place_id: number;
  photos?: { url: string; caption?: string }[];
  title?: string;
  one_line?: string;
  weather?: string;
  rating?: number;
  visited_at?: string;
}

export interface VisitLogCourseCreateRequest {
  places: VisitLogCoursePlaceCreateRequest[]; // 2개 이상
  course_title?: string; // 생략하면 서버가 방문일 기준으로 자동 생성
}

export interface VisitLogCourseCreateResponse {
  course_id: number;
  logs: VisitLogDetail[];
}

export const visitLogApi = {
  create: (placeId: number, request: VisitLogCreateRequest) =>
    apiClient.post<VisitLogDetail>(`/places/${placeId}/logs`, request, true),

  createCourseLog: (request: VisitLogCourseCreateRequest) =>
    apiClient.post<VisitLogCourseCreateResponse>('/logs/course', request, true),

  myLogs: (page = 1, size = 50) => apiClient.get<MyLogsResponse>(`/users/me/logs?page=${page}&size=${size}`, true),

  // 비인증 허용 — 장소 상세 화면에서 누구나 볼 수 있음
  logsForPlace: (placeId: number, page = 1, size = 20) =>
    apiClient.get<PlaceLogsResponse>(`/places/${placeId}/logs?page=${page}&size=${size}`),

  getDetail: (logId: number) => apiClient.get<VisitLogDetail>(`/logs/${logId}`, true),

  update: (logId: number, request: VisitLogUpdateRequest) =>
    apiClient.patch<VisitLogDetail>(`/logs/${logId}`, request, true),

  remove: (logId: number) => apiClient.delete<void>(`/logs/${logId}`, true),
};
