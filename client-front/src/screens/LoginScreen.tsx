import { useState } from 'react';
import { ActivityIndicator, Alert, Button, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { authApi, UserProfile } from '../api/auth';
import { tokenStorage } from '../auth/tokenStorage';
import { KAKAO_CLIENT_ID, KAKAO_HTTPS_REDIRECT_URI, kakaoAppReturnUrl, kakaoDiscovery } from '../auth/oauthConfig';

WebBrowser.maybeCompleteAuthSession();

type Provider = 'kakao' | 'google';

interface Props {
  onLoginSuccess: (profile: UserProfile) => void;
}

export function LoginScreen({ onLoginSuccess }: Props) {
  const [loading, setLoading] = useState<Provider | null>(null);

  // GoogleSignin.configure()는 oauthConfig.ts 모듈 로드 시 이미 한 번 호출됨.
  // 네이티브 로그인이라 브라우저/리다이렉트가 아예 없음 — Play Services가 기기 안에서 직접 처리
  async function promptGoogleLoginAsync() {
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (isSuccessResponse(response)) {
        if (response.data.idToken) {
          handleLogin('google', response.data.idToken);
        } else {
          Alert.alert('구글 로그인 실패', 'ID 토큰을 받지 못했습니다.');
        }
      }
      // response.type === 'cancelled' — 사용자가 취소, 별도 처리 불필요
    } catch (e) {
      Alert.alert('구글 로그인 실패', e instanceof Error ? e.message : '알 수 없는 오류');
    }
  }

  // 카카오는 useAuthRequest를 안 쓰고 WebBrowser를 직접 호출한다 — 카카오에 보내는 redirect_uri
  // (HTTPS 중계 엔드포인트)와 앱이 실제로 기다리는 returnUrl(dongle://redirect)이 서로 다른데,
  // useAuthRequest/promptAsync는 이 둘을 항상 같은 값으로 강제하기 때문 (2026-08-27 결정, decision-log 참고)
  async function promptKakaoLoginAsync() {
    const authUrl =
      `${kakaoDiscovery.authorizationEndpoint}` +
      `?client_id=${encodeURIComponent(KAKAO_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(KAKAO_HTTPS_REDIRECT_URI)}` +
      `&response_type=code`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, kakaoAppReturnUrl);
    if (result.type !== 'success') return; // 사용자가 취소/닫음 — 별도 처리 불필요

    const [, queryString = ''] = result.url.split('?');
    const params = new URLSearchParams(queryString);
    const code = params.get('code');

    if (code) {
      handleLogin('kakao', code);
    } else {
      Alert.alert('카카오 로그인 실패', params.get('error_description') ?? params.get('error') ?? '알 수 없는 오류');
    }
  }

  // provider별로 실제로는 다른 값(카카오=인가 code, 구글=ID 토큰)이지만 authApi 쪽에서 알맞게 처리함
  async function handleLogin(provider: Provider, credential: string) {
    try {
      setLoading(provider);
      const { access_token, refresh_token } =
        provider === 'kakao' ? await authApi.loginWithKakao(credential) : await authApi.loginWithGoogle(credential);

      await tokenStorage.save(access_token, refresh_token);
      const profile = await authApi.me();
      onLoginSuccess(profile);
    } catch (e) {
      Alert.alert('로그인 실패', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(null);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>동글</Text>
      <Text style={styles.subtitle}>안동 감성 여행 코스 추천</Text>

      <View style={styles.buttons}>
        <Button
          title={loading === 'kakao' ? '로그인 중...' : '카카오로 로그인'}
          disabled={loading !== null}
          onPress={() => promptKakaoLoginAsync()}
        />
        <View style={styles.gap} />
        <Button
          title={loading === 'google' ? '로그인 중...' : '구글로 로그인'}
          disabled={loading !== null}
          onPress={() => promptGoogleLoginAsync()}
        />
      </View>

      {loading && <ActivityIndicator style={styles.spinner} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 24 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 48 },
  buttons: { width: '100%' },
  gap: { height: 12 },
  spinner: { marginTop: 24 },
});
