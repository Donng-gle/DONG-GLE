import { API_BASE_URL } from './config';
import { tokenStorage } from '../auth/tokenStorage';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

// 액세스 토큰 만료(1시간, server-back application.yml access-token-expiry-seconds 참고) 시,
// refresh_token으로 갱신에 완전히 실패하면(리프레시 토큰도 만료/무효) 이 리스너로 App에 알려서
// 로그인 화면으로 돌려보낼 수 있게 한다. App.tsx가 registerSessionExpiredListener로 등록.
type SessionExpiredListener = () => void;
let sessionExpiredListener: SessionExpiredListener | null = null;

export function registerSessionExpiredListener(listener: SessionExpiredListener | null) {
  sessionExpiredListener = listener;
}

interface RefreshResponse {
  access_token: string;
}

// 여러 요청이 동시에 401을 받아도 갱신 호출은 한 번만 나가도록 in-flight promise를 공유.
// apiClient.post를 쓰지 않고 fetch를 직접 호출 — auth.ts의 authApi.refresh와 순환 의존을 피하기 위함
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await tokenStorage.getRefreshToken();
      if (!refreshToken) return null;

      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!response.ok) return null;

        const data = (await response.json()) as RefreshResponse;
        await tokenStorage.setAccessToken(data.access_token);
        return data.access_token;
      } catch {
        return null;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean; isRetry?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, auth = false, isRetry = false } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const accessToken = await tokenStorage.getAccessToken();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // 인증이 필요한 요청에서 401을 받으면 딱 한 번만 갱신 후 재시도. 갱신도 실패하면(리프레시 토큰
  // 만료/무효) 토큰을 정리하고 세션 만료를 알린 뒤, 아래로 흘려보내 원래 401을 그대로 던짐
  if (response.status === 401 && auth && !isRetry) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      return request<T>(path, { ...options, isRetry: true });
    }
    await tokenStorage.clear();
    sessionExpiredListener?.();
  }

  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(response.status, data?.code ?? 'UNKNOWN_ERROR', data?.message ?? '요청에 실패했습니다.');
  }

  return data as T;
}

export const apiClient = {
  get: <T>(path: string, auth = false) => request<T>(path, { method: 'GET', auth }),
  post: <T>(path: string, body?: unknown, auth = false) => request<T>(path, { method: 'POST', body, auth }),
  patch: <T>(path: string, body?: unknown, auth = false) => request<T>(path, { method: 'PATCH', body, auth }),
  delete: <T>(path: string, auth = false) => request<T>(path, { method: 'DELETE', auth }),
};
