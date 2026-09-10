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
  // 여러 날 코스 지원(2026-09-06 결정, decision-log 참고) — 이 장소가 코스의 며칠째 방문지인지.
  // "직접 코스 만들기"에서만 채워짐, AI 코스는 항상 null(단일 날짜 전제)
  visit_date: string | null;
  // 장소 카드 카테고리 라벨(2026-09-11 추가) — PLACE.category 그대로(관광지/식당/카페/액티비티/
  // 문화공간/축제행사, PlaceListItem.category와 동일 값). 백엔드가 후보 풀에서 placeId를 못 찾는
  // 예외적인 경우에만 null
  category: string | null;
}

export interface CourseGenerateRequest {
  session_id: string; // POST /swipe/candidates에서 발급받은 세션 ID
  travel_date: string; // YYYY-MM-DD
  transport: SwipeTransport;
  // 둘 다 없으면 서버가 09:00~21:00으로 폴백(server-back CourseService.DAY_START/DAY_END,
  // 2026-09-09 추가). end_time이 start_time보다 이르거나 같으면 400(INVALID_COURSE_TIME_RANGE)
  start_time?: string | null; // HH:mm
  end_time?: string | null; // HH:mm
  // 여행 날짜 다중 선택 지원(2026-09-10 추가) — 없으면 travel_date 하루짜리 코스(기존과 동일).
  // 있으면 travel_date~end_date 날짜마다 AI가 따로 코스를 짜서 이어붙임(장소 중복 없음).
  // end_date가 travel_date보다 이르면 400(INVALID_COURSE_DATE_RANGE)
  end_date?: string | null; // YYYY-MM-DD
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
  // 여러 날 코스 지원(2026-09-06 결정, decision-log 참고) — 이 장소가 코스의 며칠째 방문지인지.
  // travel_date~end_date 범위를 벗어나면 서버가 400(INVALID_COURSE_DATE_RANGE)
  visit_date?: string | null;
}

export interface CourseSaveRequest {
  candidate_id?: string | null; // /courses/generate 결과를 그대로 저장할 때 사용
  title: string;
  travel_date?: string | null;
  // 여러 날 AI 코스 저장 지원(2026-09-10 추가) — /courses/generate에 end_date를 줘서 만든 여러 날
  // 코스를 그대로 저장할 때 사용(CourseManualRequest.end_date와 동일 규칙)
  end_date?: string | null;
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
