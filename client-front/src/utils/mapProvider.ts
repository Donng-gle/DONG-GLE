import { PROVIDER_GOOGLE } from 'react-native-maps';

// iOS 전환 작업 중 추가(2026-09-13), iOS Google Maps SDK 키 설정 완료로 통일(2026-09-14).
// app.config.js의 ios.config.googleMapsApiKey로 Google Maps iOS SDK가 네이티브에 연결되므로
// Android/iOS 모두 PROVIDER_GOOGLE 사용. (네이티브 설정 없이 이 값만 GOOGLE로 두면 iOS에서
// 크래시하니, 만약 되돌려야 하면 반드시 app.config.js의 ios.config도 같이 확인할 것)
export const MAP_PROVIDER = PROVIDER_GOOGLE;
