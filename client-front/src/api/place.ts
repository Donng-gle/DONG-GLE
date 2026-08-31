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
  is_liked: boolean | null; // 비인증 조회 시 null
}

export interface LikeResponse {
  is_liked: boolean;
}

export const placeApi = {
  // 비인증 허용 — 로그인 전에도 장소 탐색 가능 (SecurityConfig permitAllGetPaths 참고)
  list: (params: { category?: PlaceCategory; travelDate?: string; page?: number; size?: number } = {}) => {
    const { category, travelDate, page = 1, size = 20 } = params;
    const query = new URLSearchParams({ page: String(page), size: String(size) });
    if (category) query.set('category', category);
    if (travelDate) query.set('travel_date', travelDate);
    return apiClient.get<PlacesResponse>(`/places?${query.toString()}`);
  },

  // bounds: "swLat,swLng,neLat,neLng" 형식
  map: (bounds: string, params: { category?: PlaceCategory; travelDate?: string } = {}) => {
    const { category, travelDate } = params;
    const query = new URLSearchParams({ bounds });
    if (category) query.set('category', category);
    if (travelDate) query.set('travel_date', travelDate);
    return apiClient.get<PlaceMapResponse>(`/places/map?${query.toString()}`);
  },

  // 인증 유저는 개인화(user_preference 상위 태그 매칭) 반영, 비인증은 인기순 고정 (is_personalized로 구분)
  featured: (limit = 10) => apiClient.get<FeaturedPlacesResponse>(`/places/featured?limit=${limit}`),

  search: (q: string, page = 1, size = 20) =>
    apiClient.get<PlacesResponse>(`/places/search?q=${encodeURIComponent(q)}&page=${page}&size=${size}`),

  getDetail: (placeId: number) => apiClient.get<PlaceDetail>(`/places/${placeId}`),

  like: (placeId: number) => apiClient.post<LikeResponse>(`/places/${placeId}/like`, undefined, true),

  unlike: (placeId: number) => apiClient.delete<LikeResponse>(`/places/${placeId}/like`, true),
};
