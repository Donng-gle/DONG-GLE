import * as AuthSession from 'expo-auth-session';

// 카카오/구글 개발자 콘솔에 앱 등록 후 발급되는 값. client-front/.env에 채워넣을 것 (커밋 금지)
export const KAKAO_CLIENT_ID = process.env.EXPO_PUBLIC_KAKAO_CLIENT_ID ?? '';
export const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';

// app.json의 scheme("dongle")을 이용한 딥링크 리다이렉트 URI.
// 이 값을 카카오/구글 개발자 콘솔의 Redirect URI로도 등록해야 함
export const redirectUri = AuthSession.makeRedirectUri({ scheme: 'dongle' });

export const kakaoDiscovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize',
};

export const googleDiscovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
};
