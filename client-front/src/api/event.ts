import { apiClient } from './client';
import { PaginationMeta } from './place';

export interface EventListItem {
  id: number;
  name: string;
  main_image_url: string | null;
  addr1: string | null;
  event_start_date: string;
  event_end_date: string;
  tags: string[];
  d_day: number; // 음수면 이미 종료, 0이면 진행 중, 양수면 시작까지 남은 일수
}

export interface EventsResponse {
  events: EventListItem[];
  meta: PaginationMeta;
}

export const eventApi = {
  // month 생략 시 이번 달 기준 (server EventService.listEvents 참고). 비인증 허용.
  list: (params: { month?: string; page?: number; size?: number } = {}) => {
    const { month, page = 1, size = 20 } = params;
    const query = new URLSearchParams({ page: String(page), size: String(size) });
    if (month) query.set('month', month); // YYYY-MM
    return apiClient.get<EventsResponse>(`/events?${query.toString()}`);
  },
};
