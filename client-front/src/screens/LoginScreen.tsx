import { useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { authApi, UserProfile } from '../api/auth';
import { tokenStorage } from '../auth/tokenStorage';
import { KAKAO_CLIENT_ID, KAKAO_HTTPS_REDIRECT_URI, kakaoAppReturnUrl, kakaoDiscovery } from '../auth/oauthConfig';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

WebBrowser.maybeCompleteAuthSession();

type Provider = 'kakao' | 'google';

// TourAPI 190건 중 월영교(place.id=116)의 실제 등록 사진 — Figma 목업이 쓰던 사진은
// 워터마크 있는 미리보기 스톡 이미지라 그대로 못 씀 (2026-08-31 결정, decision-log 참고)
const HERO_IMAGE_URL = 'https://tong.visitkorea.or.kr/cms/resource_photo/85/4062785_image2_1.jpg';

interface Props {
  onLoginSuccess: (profile: UserProfile) => void;
}

export function LoginScreen({ onLoginSuccess }: Props) {
  const [loading, setLoading] = useState<Provider | null>(null);
  const insets = useSafeAreaInsets();

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

  // 게스트 모드: 이번 단계는 UI만 반영 — App.tsx 네비게이션 구조가 아직 비로그인 상태를
  // 지원하지 않음, 실제 게스트 진입 구현은 별도 작업으로 확정됨 (2026-08-31 결정, decision-log 참고)
  function handleGuestPress() {
    Alert.alert('준비 중', '비로그인 이용은 아직 준비 중이에요. 곧 만나요!');
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.hero}>
        <Image source={{ uri: HERO_IMAGE_URL }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      </View>

      <View style={[styles.sheet, { paddingBottom: Math.max(36, insets.bottom + 16) }]}>
        <View style={styles.handle} />

        <Text style={styles.title}>로그인하기</Text>

        <TouchableOpacity
          style={[styles.button, styles.kakaoButton]}
          disabled={loading !== null}
          onPress={() => promptKakaoLoginAsync()}
        >
          {loading === 'kakao' ? (
            <ActivityIndicator color={colors.gray700} />
          ) : (
            <>
              <View style={styles.kakaoSymbol}>
                <View style={styles.kakaoSymbolBubble} />
              </View>
              <Text style={styles.kakaoButtonText}>카카오 로그인</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.googleButton]}
          disabled={loading !== null}
          onPress={() => promptGoogleLoginAsync()}
        >
          {loading === 'google' ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <View style={styles.googleSymbol}>
                <Image source={require('../../assets/images/google-logo.png')} style={styles.googleLogoImage} />
              </View>
              <Text style={styles.googleButtonText}>Google 로그인</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.guestRow}>
          <View style={styles.divider} />
          <TouchableOpacity onPress={handleGuestPress} disabled={loading !== null}>
            <Text style={styles.guestText}>비로그인 상태로 계속 진행</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
        </View>

        <Text style={styles.guideText}>개인 맞춤형 장소 추천 및 코스 생성을 원하시면 로그인하세요</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  hero: { flex: 1 },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.divider,
    marginBottom: 18,
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.5,
    color: colors.black,
    marginBottom: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 6,
  },
  kakaoButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  kakaoSymbol: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fee500',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  kakaoSymbolBubble: { width: 11, height: 9, borderRadius: 4, backgroundColor: colors.black },
  kakaoButtonText: { fontFamily: fonts.regular, fontSize: 16, letterSpacing: -0.4, color: colors.gray700 },
  googleButton: { backgroundColor: colors.black, marginBottom: 20 },
  googleSymbol: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  googleLogoImage: { width: 12, height: 12 },
  googleButtonText: { fontFamily: fonts.regular, fontSize: 16, letterSpacing: -0.4, color: colors.white },
  guestRow: { flexDirection: 'row', alignItems: 'center' },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  guestText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16.8,
    letterSpacing: -0.3,
    color: colors.gray700,
    marginHorizontal: 8,
  },
  guideText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16.8,
    letterSpacing: -0.3,
    color: colors.gray400,
    textAlign: 'center',
    marginTop: 24,
  },
});
