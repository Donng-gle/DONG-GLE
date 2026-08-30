import { apiClient } from './client';

export interface OAuthLoginResponse {
  access_token: string;
  refresh_token: string;
  is_new_user: boolean;
}

export interface RefreshResponse {
  access_token: string;
}

export interface UserProfile {
  id: number;
  nickname: string;
  profile_image_url: string | null;
  oauth_provider: 'kakao' | 'google';
  has_onboarded: boolean;
  created_at: string;
}

export const authApi = {
  loginWithKakao: (code: string) =>
    apiClient.post<OAuthLoginResponse>('/auth/oauth/kakao', { code }),

  // 서버가 code→client_secret 교환 방식에서 ID 토큰 검증 방식으로 전환됨 (2026-08-26 결정,
  // decision-log 참고) — 네이티브 Google Sign-In이 돌려주는 idToken을 그대로 보낸다
  loginWithGoogle: (idToken: string) =>
    apiClient.post<OAuthLoginResponse>('/auth/oauth/google', { id_token: idToken }),

  refresh: (refreshToken: string) =>
    apiClient.post<RefreshResponse>('/auth/refresh', { refresh_token: refreshToken }),

  logout: () => apiClient.delete<void>('/auth/logout', true),

  me: () => apiClient.get<UserProfile>('/users/me', true),
};
