import { Platform } from 'react-native';
import { PROVIDER_GOOGLE } from 'react-native-maps';

// iOS 전환 작업 중 추가(2026-09-13). PROVIDER_GOOGLE을 iOS에서 쓰려면 Google Maps iOS SDK +
// 별도 iOS용 API 키 설정(app.json)이 필요한데 아직 발급 전이라, 그 전까지 iOS는 기본 지도(Apple
// Maps)를 쓰도록 undefined로 둔다. Android는 기존대로 구글맵 유지. iOS Maps SDK 키 발급되면
// 아래 한 줄만 고치면 전체 화면에 반영됨(PROVIDER_GOOGLE로 통일)
export const MAP_PROVIDER = Platform.OS === 'ios' ? undefined : PROVIDER_GOOGLE;
