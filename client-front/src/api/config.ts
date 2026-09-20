import { Platform } from 'react-native';

// 로컬 개발 서버 주소 (기본값).
// - iOS 시뮬레이터: localhost가 Mac 호스트를 그대로 가리켜서 동작함
// - Android 에뮬레이터: localhost가 에뮬레이터 자신을 가리키므로 10.0.2.2로 접속해야 Mac 호스트에 닿음
// - 실기기: 10.0.2.2도 localhost도 아예 안 닿음(실제로 ConnectException 발생 확인, 2026-08-31) —
//   같은 Wi-Fi의 Mac LAN IP나, 배포된 백엔드(Render) 주소를 EXPO_PUBLIC_API_BASE_URL로 넣어서 덮어써야 함
const DEFAULT_API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
