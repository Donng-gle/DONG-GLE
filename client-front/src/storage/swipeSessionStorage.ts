import * as SecureStore from 'expo-secure-store';

const SESSION_ID_KEY = 'dongle_swipe_session_id';

// 진행 중인 스와이프 세션 ID만 로컬에 남겨둔다. travel_date/transport 등 나머지 정보는
// 복원 시 GET /swipe/sessions/{id}(서버가 갖고 있는 값)로 다시 받아오므로 따로 저장하지 않음 —
// 로컬 값과 서버 값이 어긋날 위험을 원천 차단
export const swipeSessionStorage = {
  save: (sessionId: string) => SecureStore.setItemAsync(SESSION_ID_KEY, sessionId),
  load: () => SecureStore.getItemAsync(SESSION_ID_KEY),
  clear: () => SecureStore.deleteItemAsync(SESSION_ID_KEY),
};
