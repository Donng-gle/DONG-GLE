import * as AuthSession from 'expo-auth-session';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// 카카오/구글 개발자 콘솔에 앱 등록 후 발급되는 값. client-front/.env에 채워넣을 것 (커밋 금지)
export const KAKAO_CLIENT_ID = process.env.EXPO_PUBLIC_KAKAO_CLIENT_ID ?? '';
export const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';
// iOS 전용 OAuth 클라이언트 ID(2026-09-13 발급, iOS 앱은 번들 ID로 신원 증명하는 별도 플랫폼
// 클라이언트가 필요함 — Android의 패키지명+SHA-1과 대응). app.json의 google-signin 플러그인
// iosUrlScheme(REVERSED_CLIENT_ID)도 이 값과 짝이 맞아야 함
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

// 구글은 네이티브 Google Sign-In(Android는 패키지명+SHA-1, iOS는 번들 ID로 각각 신원 증명)을 쓴다
// (2026-08-26 결정, decision-log 참고). webClientId는 Web 애플리케이션 클라이언트 ID — 실제 로그인엔
// 안 쓰이고 발급되는 ID 토큰의 audience(서버가 검증하는 값)를 지정하는 용도라 플랫폼과 무관하게
// 동일값 유지. iosClientId는 iOS 네이티브 로그인 플로우 자체에 필요(2026-09-13 iOS 전환 추가).
// 앱 시작 시 한 번만 호출하면 됨
GoogleSignin.configure({ webClientId: GOOGLE_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID });

// 카카오 개발자 콘솔의 Redirect URI는 커스텀 스킴(dongle://)을 "유효하지 않은 URL"로 거부한다
// (2026-08-27 확인, decision-log 참고). 그래서 카카오한테는 이 HTTPS 중계 엔드포인트 주소를 보내고,
// 그 엔드포인트가 최종적으로 302로 넘겨주는 커스텀 스킴(kakaoAppReturnUrl)을 앱이 따로 기다린다.
// server-back/.env의 KAKAO_REDIRECT_URI와 반드시 같은 값이어야 함
export const KAKAO_HTTPS_REDIRECT_URI = 'https://dong-gle.onrender.com/auth/kakao/callback';
export const kakaoAppReturnUrl = AuthSession.makeRedirectUri({ scheme: 'dongle', path: 'redirect' });

export const kakaoDiscovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize',
};
