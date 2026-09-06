import { apiClient } from './client';
import { SwipeTransport } from './swipe';

export type CourseSource = 'ai' | 'ai_edited' | 'user';

export interface CoursePlaceItem {
  place_id: number;
  name: string;
  visit_order: number;
  planned_time: string | null;
  lat: number | null;
  lng: number | null;
  main_image_url: string | null;
  // 구글맵 Directions 계산 실패 시(좌표 없는 장소 포함 등) null로 폴백됨
  distance_from_prev_km: number | null;
  duration_from_prev_min: number | null;
}

export interface CourseGenerateRequest {
  session_id: string; // POST /swipe/candidates에서 발급받은 세션 ID
  travel_date: string; // YYYY-MM-DD
  transport: SwipeTransport;
}

export interface CourseCandidate {
  candidate_id: string;
  title: string;
  places: CoursePlaceItem[];
  // course_optimizer/구글맵 연동 실패 시 null로 폴백됨
  total_distance_km: number | null;
  total_duration_min: number | null;
}

export interface CourseGenerateResponse {
  // 스펙상 최대 3개지만 course_optimizer 알고리즘 한계로 지금은 항상 1개만 옴 (decision-log 2026-08-30 참고)
  candidates: CourseCandidate[];
}

export interface CoursePlaceRequest {
  place_id: number;
  visit_order: number;
  planned_time?: string | null;
}

export interface CourseSaveRequest {
  candidate_id?: string | null; // /courses/generate 결과를 그대로 저장할 때 사용
  title: string;
  travel_date?: string | null;
  transport?: SwipeTransport | null; // 없으면 조회 시 walk 기본값으로 경로 재계산
  source: CourseSource;
  places: CoursePlaceRequest[];
}

export interface CourseManualRequest {
  title: string;
  travel_date?: string | null;
  // 여러 날 범위 지원(2026-09-06 결정, decision-log 참고) — "직접 코스 만들기"에서만 사용.
  // travel_date보다 이전이면 서버가 400(INVALID_COURSE_DATE_RANGE)
  end_date?: string | null;
  transport?: SwipeTransport | null;
  places: CoursePlaceRequest[];
}

export interface CourseSaveResponse {
  course_id: number;
}

export interface CourseUpdateRequest {
  title?: string;
  source?: CourseSource;
  places?: CoursePlaceRequest[];
}

export interface CourseDetail {
  id: number;
  title: string;
  travel_date: string | null;
  end_date: string | null; // 여러 날 범위 지원(2026-09-06 결정, decision-log 참고). 직접 코스에서만 채워짐
  source: string;
  places: CoursePlaceItem[];
  total_distance_km: number | null;
  total_duration_min: number | null;
  polyline: string | null;
  updated_at: string;
}

export interface CourseListItem {
  id: number;
  title: string;
  travel_date: string | null;
  end_date: string | null; // 여러 날 범위 지원(2026-09-06 결정, decision-log 참고). 직접 코스에서만 채워짐
  source: string;
  place_count: number;
  thumbnail_url: string | null;
  // 스크랩북 카드의 썸네일 스트립용 — 방문 순서 기준 최대 3장. place_count가 이 배열 길이보다
  // 크면 그 차이를 "N+" 배지로 표시 (2026-09-05 추가, decision-log 참고)
  place_thumbnails: string[];
  created_at: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  size: number;
  has_next: boolean;
}

export interface MyCoursesResponse {
  courses: CourseListItem[];
  meta: PaginationMeta;
}

export const courseApi = {
  myCourses: (page = 1, size = 20) =>
    apiClient.get<MyCoursesResponse>(`/users/me/courses?page=${page}&size=${size}`, true),

  // 세션 만료(24시간 초과) 시 410(ApiError)
  generate: (request: CourseGenerateRequest) =>
    apiClient.post<CourseGenerateResponse>('/courses/generate', request, true),

  // AI 생성 후보(candidate_id) 또는 직접 구성한 장소 목록을 저장
  save: (request: CourseSaveRequest) => apiClient.post<CourseSaveResponse>('/courses', request, true),

  saveManual: (request: CourseManualRequest) =>
    apiClient.post<CourseSaveResponse>('/courses/manual', request, true),

  getDetail: (courseId: number) => apiClient.get<CourseDetail>(`/courses/${courseId}`, true),

  update: (courseId: number, request: CourseUpdateRequest) =>
    apiClient.patch<CourseDetail>(`/courses/${courseId}`, request, true),

  remove: (courseId: number) => apiClient.delete<void>(`/courses/${courseId}`, true),
};
