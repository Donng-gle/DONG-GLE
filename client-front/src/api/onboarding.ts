import { apiClient } from './client';

export type OnboardingAction = 'like' | 'dislike';
export type CardSelectionStrategy = 'seed' | 'balance' | 'explore' | 'random';

export interface UserVector {
  relaxing: number;
  lively: number;
  romantic: number;
  local: number;
  photogenic: number;
  traditional: number;
  modern: number;
}

export interface OnboardingCard {
  id: number;
  name: string;
  image_url: string;
  vector: UserVector;
  is_seed: boolean;
}

export interface OnboardingNextResponse {
  card: OnboardingCard;
  strategy: CardSelectionStrategy;
  weak_tags: string[];
}

export interface OnboardingSwipeResponse {
  user_vector: UserVector;
  total_seen: number;
  is_converged: boolean;
  recent_change: number;
  // 수렴/종료 시 null — /onboarding/next를 따로 호출하지 않아도 됨
  next_card?: OnboardingNextResponse | null;
}

export interface OnboardingCompleteResponse {
  user_vector: UserVector;
  top_tags: string[];
}

export interface OnboardingStatusResponse {
  total_seen: number;
  like_count: number;
  dislike_count: number;
  is_converged: boolean;
  user_vector: UserVector;
  shown_card_ids: number[];
}

export interface OnboardingResetResponse {
  user_vector: UserVector;
  message: string;
}

export const onboardingApi = {
  getStatus: () => apiClient.get<OnboardingStatusResponse>('/onboarding/status', true),

  // 서버가 더 보여줄 카드가 없으면(수렴 완료 또는 25장 도달) 204를 반환하고,
  // apiClient는 이 경우 undefined를 돌려줌 — 온보딩 종료 신호로 사용
  getNext: () => apiClient.get<OnboardingNextResponse | undefined>('/onboarding/next', true),

  swipe: (cardId: number, action: OnboardingAction) =>
    apiClient.post<OnboardingSwipeResponse>('/onboarding/swipe', { card_id: cardId, action }, true),

  complete: () => apiClient.post<OnboardingCompleteResponse>('/onboarding/complete', undefined, true),

  reset: () => apiClient.post<OnboardingResetResponse>('/onboarding/reset', undefined, true),
};
