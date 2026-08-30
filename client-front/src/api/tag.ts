import { apiClient } from './client';

export interface TagItem {
  tag: string;
  label: string;
  description: string;
  criteria: string[];
}

export interface TagsResponse {
  tags: TagItem[];
}

export const tagApi = {
  // 감성태그 7개 대분류 기준 목록 (고정 카탈로그, 비인증 허용)
  list: () => apiClient.get<TagsResponse>('/tags'),
};
