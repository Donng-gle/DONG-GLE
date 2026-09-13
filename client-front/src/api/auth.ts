import { apiClient } from './client';

export interface OAuthLoginResponse {
  access_token: string;
  refresh_token: string;
  is_new_user: boolean;
}

export interface RefreshResponse {
  access_token: string;
  // 리프레시 토큰 회전(2026-09-04 도입) — 실제 갱신 흐름은 api/client.ts가 자체 구현하므로
  // (순환 의존 회피, 아래 참고) 이 함수 자체는 현재 호출되는 곳이 없음
  refresh_token: string;
}

export interface UserProfile {
  id: number;
  nickname: string;
  profile_image_url: string | null;
  oauth_provider: 'kakao' | 'google' | 'apple';
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

  // 구글과 동일한 ID 토큰 검증 방식 (2026-09-14 추가, 앱스토어 심사 가이드라인 4.8 대응) —
  // 네이티브 Sign in with Apple(expo-apple-authentication)이 돌려주는 identityToken을 그대로 보낸다
  loginWithApple: (idToken: string) =>
    apiClient.post<OAuthLoginResponse>('/auth/oauth/apple', { id_token: idToken }),

  refresh: (refreshToken: string) =>
    apiClient.post<RefreshResponse>('/auth/refresh', { refresh_token: refreshToken }),

  logout: () => apiClient.delete<void>('/auth/logout', true),

  me: () => apiClient.get<UserProfile>('/users/me', true),
};
