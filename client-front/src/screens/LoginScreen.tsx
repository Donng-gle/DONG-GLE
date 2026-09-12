import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
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
  onGuestContinue: () => void;
}

type Step = 'intro' | 'login';

export function LoginScreen({ onLoginSuccess, onGuestContinue }: Props) {
  // 실제 Figma 플로우: 히어로 사진 + "계속하기"(intro) → 탭하면 로그인 옵션 바텀시트(login)가
  // 같은 사진 위로 올라오는 2단계 구성 (2026-08-31 확인, decision-log 참고)
  const [step, setStep] = useState<Step>('intro');
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
    // scope 파라미터가 아예 없어서 카카오가 "닉네임" 동의항목을 요청 안 하고 있었음(2026-09-12,
    // 사용자 리포트 — 로그인해도 실제 닉네임 대신 KakaoOAuthClient.kt의 폴백값 "카카오유저"만 뜸).
    // 처음엔 account_email도 같이 넣었다가 콘솔에 등록 안 된 scope를 요청해서 KOE205("서비스 설정에
    // 오류가 있어 이용할 수 없음")로 로그인 자체가 막혀버림(사용자 재현) — account_email은 최근
    // 카카오 정책상 비즈니스 앱 전환이 필요한 경우가 많아 일단 빼고, 콘솔에서 별도 설정 없이도 켤 수
    // 있는 profile_nickname만 요청. 콘솔(카카오 로그인 > 동의항목)에서 "닉네임"이 최소 "선택 동의"로
    // 켜져 있어야 실제로 값이 내려옴 — 꺼져 있으면 이것도 KOE205
    const authUrl =
      `${kakaoDiscovery.authorizationEndpoint}` +
      `?client_id=${encodeURIComponent(KAKAO_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(KAKAO_HTTPS_REDIRECT_URI)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent('profile_nickname')}`;

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

  // 게스트 모드 실제 진입 구현 완료 (2026-09-03, decision-log 참고).
  // 이 텍스트 링크는 디자인상 버튼이 아니라 그냥 텍스트로만 되어 있음 — 디자인팀(전성빈)에
  // 확인해서 버튼 형태로 바꿀지 논의 예정, 지금은 있는 그대로 둠
  function handleGuestPress() {
    onGuestContinue();
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <Image source={{ uri: HERO_IMAGE_URL }} style={StyleSheet.absoluteFill} resizeMode="cover" />

      {step === 'intro' ? (
        <View style={styles.introOverlay}>
          <LinearGradient colors={['transparent', colors.white]} style={styles.introGradient} />

          <View style={[styles.introContent, { paddingBottom: Math.max(24, insets.bottom + 16) }]}>
            <Text style={styles.introTitle}>여행지를{'\n'}발견해보세요</Text>
            <Text style={styles.introSubtitle}>
              안동의 멋진 장소와 숨겨진 명소를{'\n'}앱에서 손쉽게 탐험해보세요.
            </Text>
            <TouchableOpacity style={styles.continueButton} onPress={() => setStep('login')}>
              <Text style={styles.continueButtonText}>계속하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.loginOverlay}>
          {/* 시트 바깥(사진 영역)을 탭하면 intro로 돌아감 — 바텀시트 흔한 관례 */}
          <Pressable style={styles.dismissArea} onPress={() => setStep('intro')} />

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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  introOverlay: { flex: 1 },
  introGradient: { position: 'absolute', top: '28%', left: 0, right: 0, bottom: 0 },
  introContent: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20 },
  introTitle: {
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 33.6,
    color: colors.black,
    marginBottom: 12,
  },
  introSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 19.2,
    color: colors.gray500,
    marginBottom: 32,
  },
  continueButton: {
    height: 48,
    borderRadius: 6,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: { fontFamily: fonts.semiBold, fontSize: 16, letterSpacing: -0.4, color: colors.white },
  loginOverlay: { flex: 1 },
  dismissArea: { flex: 1 },
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
