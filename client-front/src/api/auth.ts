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

  loginWithGoogle: (code: string) =>
    apiClient.post<OAuthLoginResponse>('/auth/oauth/google', { code }),

  refresh: (refreshToken: string) =>
    apiClient.post<RefreshResponse>('/auth/refresh', { refresh_token: refreshToken }),

  logout: () => apiClient.delete<void>('/auth/logout', true),

  me: () => apiClient.get<UserProfile>('/users/me', true),
};
