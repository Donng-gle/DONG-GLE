import { apiClient } from './client';
import { PlaceCategory } from './place';

// api_1.3.1v.yaml SwipeCandidatesRequest.transport / CourseGenerateRequest.transport와 동일한 값
// (server-back SwipeTransport.kt 참고). ai/course_optimizer의 transport_mode와는 값이 다름 — public ≠ transit.
export type SwipeTransport = 'car' | 'walk' | 'public';

// like: 마음에 드는 장소. skip: 넘긴 장소. must: 코스 생성 시 반드시 포함될 필수 방문 장소.
export type SwipeAction = 'like' | 'skip' | 'must';

export interface SwipeCandidatesRequest {
  travel_date: string; // YYYY-MM-DD
  transport: SwipeTransport;
  mood_tags?: string[]; // 비어있으면 user_preference 상위 태그 자동 사용
  preferred_categories?: PlaceCategory[]; // 비어있으면 전체 카테고리
}

export interface SwipeCandidate {
  place_id: number;
  name: string;
  main_image_url: string | null;
  category: string;
  tags: string[];
}

export interface SwipeCandidatesResponse {
  session_id: string;
  expires_at: string;
  candidates: SwipeCandidate[];
}

export interface SwipedResultItem {
  place_id: number;
  action: SwipeAction;
}

export interface SwipeSessionDetail {
  session_id: string;
  expires_at: string;
  travel_date: string;
  transport: SwipeTransport;
  candidates: SwipeCandidate[]; // 아직 스와이프하지 않은 잔여 후보
  swiped_results: SwipedResultItem[]; // 화면 복원용 — 이미 처리된 카드
}

export interface SwipeResultRequest {
  swipes: SwipedResultItem[];
}

export const swipeApi = {
  // 세션 24시간 유효. session_id는 이후 결과 제출/코스 생성에 반드시 필요
  createSession: (request: SwipeCandidatesRequest) =>
    apiClient.post<SwipeCandidatesResponse>('/swipe/candidates', request, true),

  // 앱 복귀/재시작 시 진행 중이던 세션 복원. 세션 만료 시 410(ApiError)
  getSession: (sessionId: string) =>
    apiClient.get<SwipeSessionDetail>(`/swipe/sessions/${sessionId}`, true),

  // 성공 시 204(본문 없음). 세션 만료 시 410(ApiError)
  submitResults: (sessionId: string, request: SwipeResultRequest) =>
    apiClient.post<void>(`/swipe/sessions/${sessionId}/results`, request, true),
};
