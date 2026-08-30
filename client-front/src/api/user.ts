import { apiClient } from './client';
import { UserProfile } from './auth';
import { PlacesResponse } from './place';

export interface UpdateProfileRequest {
  nickname?: string;
  profile_image_url?: string;
}

export interface UserPreferenceTag {
  tag: string;
  score: number;
}

export interface UserPreferencesResponse {
  preferences: UserPreferenceTag[];
}

export type DevicePlatform = 'ios' | 'android';

export interface NotificationSetting {
  push_enabled: boolean;
  event_alert: boolean;
  course_reminder: boolean;
}

export interface DeviceTokenRequest {
  fcm_token: string;
  platform: DevicePlatform;
}

export const userApi = {
  updateProfile: (request: UpdateProfileRequest) => apiClient.patch<UserProfile>('/users/me', request, true),

  withdraw: () => apiClient.delete<void>('/users/me', true),

  // 취향 벡터(온보딩+스와이프+방문기록 누적) — 내 취향 프로필 레이더 차트에 사용 (ssot.md 참고)
  getPreferences: () => apiClient.get<UserPreferencesResponse>('/users/me/preferences', true),

  getLikes: (page = 1, size = 20) => apiClient.get<PlacesResponse>(`/users/me/likes?page=${page}&size=${size}`, true),

  getNotificationSetting: () => apiClient.get<NotificationSetting>('/users/me/notification', true),

  updateNotificationSetting: (request: NotificationSetting) =>
    apiClient.patch<NotificationSetting>('/users/me/notification', request, true),

  // fcm_token은 expo-notifications 등 푸시 라이브러리로 발급받은 실제 토큰이 필요 — 아직 미도입.
  // 요청 함수 자체는 순수 request/response라 미리 준비해둠 (client-front 미사용 상태)
  registerDeviceToken: (request: DeviceTokenRequest) =>
    apiClient.post<void>('/users/me/device-token', request, true),
};
