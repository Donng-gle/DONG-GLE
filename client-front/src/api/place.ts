import { apiClient } from './client';

// server-back PlaceCategory.kt 그대로 (한글 enum 값)
export type PlaceCategory = '관광지' | '식당' | '카페' | '액티비티' | '문화공간' | '축제행사';

export interface PaginationMeta {
  total: number;
  page: number;
  size: number;
  has_next: boolean;
}

export interface PlaceListItem {
  id: number;
  name: string;
  category: string;
  main_image_url: string | null;
  addr1: string | null;
  lat: number | null;
  lng: number | null;
  tags: string[];
  is_liked: boolean;
}

export interface PlacesResponse {
  places: PlaceListItem[];
  meta: PaginationMeta;
}

export interface PlaceMapPin {
  id: number;
  name: string;
  category: string;
  lat: number | null;
  lng: number | null;
  main_image_url: string | null;
  tags: string[];
  is_liked: boolean;
}

export interface PlaceMapResponse {
  pins: PlaceMapPin[];
  total: number;
}

export interface FeaturedPlacesResponse {
  places: PlaceListItem[];
  is_personalized: boolean;
}

export interface PlaceImage {
  id: number;
  img_url: string;
  sort_order: number;
}

export interface PlaceHours {
  open_day: number; // 0=일 ~ 6=토
  open_time: string; // HH:mm:ss
  close_day: number | null;
  close_time: string | null; // null이면 open_day 당일 24시간 영업
}

export interface PlaceDetail {
  id: number;
  content_id: string;
  name: string;
  category: string;
  addr1: string | null;
  addr2: string | null;
  lat: number | null;
  lng: number | null;
  tel: string | null;
  main_image_url: string | null;
  overview: string | null;
  homepage: string | null;
  event_start_date: string | null;
  event_end_date: string | null;
  images: PlaceImage[];
  hours: PlaceHours[];
  top_tags: string[];
  visit_log_count: number;
  // 방문 기록 별점(1~5, 선택 입력)의 평균. 아무도 별점을 안 남겼으면 null
  // (2026-09-05 추가, decision-log 참고)
  avg_rating: number | null;
  is_liked: boolean | null; // 비인증 조회 시 null
  // 하트 아이콘 아래 숫자 — 예전엔 이 필드가 없어서 PlaceDetailScreen이 실수로 visit_log_count를
  // 대신 바인딩해서 찜을 눌러도 숫자가 안 바뀌었음(2026-09-12, 사용자 리포트+백엔드에 필드 추가)
  like_count: number;
}

export interface LikeResponse {
  is_liked: boolean;
  like_count: number;
}

export const placeApi = {
  // 비인증도 허용되는 조회 API(SecurityConfig permitAllGetPaths 참고)지만, 로그인 상태면 토큰을
  // 실어 보내야 서버(JwtAuthenticationFilter — 토큰 있으면 검증해서 심고, 없어도 그냥 통과시키는
  // "선택적 인증" 구조)가 요청자를 식별해서 is_liked/개인화 결과를 정확히 내려줌. auth:true를
  // 안 넘기면 로그인 상태여도 매번 비로그인 취급되어 is_liked가 항상 null/false로 오는 버그가
  // 있었음(2026-09-11 발견 — 실기기 QA 중 로그인 상태에서도 찜이 "로그인이 필요해요"로 막힘)
  list: (params: { category?: PlaceCategory; travelDate?: string; page?: number; size?: number } = {}) => {
    const { category, travelDate, page = 1, size = 20 } = params;
    const query = new URLSearchParams({ page: String(page), size: String(size) });
    if (category) query.set('category', category);
    if (travelDate) query.set('travel_date', travelDate);
    return apiClient.get<PlacesResponse>(`/places?${query.toString()}`, true);
  },

  // bounds: "swLat,swLng,neLat,neLng" 형식
  map: (bounds: string, params: { category?: PlaceCategory; travelDate?: string } = {}) => {
    const { category, travelDate } = params;
    const query = new URLSearchParams({ bounds });
    if (category) query.set('category', category);
    if (travelDate) query.set('travel_date', travelDate);
    return apiClient.get<PlaceMapResponse>(`/places/map?${query.toString()}`, true);
  },

  // 인증 유저는 개인화(user_preference 상위 태그 매칭) 반영, 비인증은 인기순 고정 (is_personalized로 구분)
  featured: (limit = 10) => apiClient.get<FeaturedPlacesResponse>(`/places/featured?limit=${limit}`, true),

  search: (q: string, page = 1, size = 20) =>
    apiClient.get<PlacesResponse>(`/places/search?q=${encodeURIComponent(q)}&page=${page}&size=${size}`, true),

  getDetail: (placeId: number) => apiClient.get<PlaceDetail>(`/places/${placeId}`, true),

  like: (placeId: number) => apiClient.post<LikeResponse>(`/places/${placeId}/like`, undefined, true),

  unlike: (placeId: number) => apiClient.delete<LikeResponse>(`/places/${placeId}/like`, true),
};
