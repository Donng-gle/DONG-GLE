import { Platform } from 'react-native';

// 로컬 개발 서버 주소.
// - iOS 시뮬레이터: localhost가 Mac 호스트를 그대로 가리켜서 동작함
// - Android 에뮬레이터: localhost가 에뮬레이터 자신을 가리키므로 10.0.2.2로 접속해야 Mac 호스트에 닿음
// - 실기기: 같은 Wi-Fi의 Mac IP로 바꿔야 함 (예: http://192.168.0.10:8080)
export const API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';
