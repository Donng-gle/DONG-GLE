import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import Svg, { Path } from 'react-native-svg';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { authApi, UserProfile } from '../api/auth';
import { tokenStorage } from '../auth/tokenStorage';
import { KAKAO_CLIENT_ID, KAKAO_HTTPS_REDIRECT_URI, kakaoAppReturnUrl, kakaoDiscovery } from '../auth/oauthConfig';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

WebBrowser.maybeCompleteAuthSession();

type Provider = 'kakao' | 'google' | 'apple';

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

  // 애플은 iOS 네이티브 Sign in with Apple(expo-apple-authentication)로 로그인 — 앱스토어 심사
  // 가이드라인 4.8 대응(2026-09-14 추가). Android에는 API 자체가 없어 버튼도 iOS에서만 노출
  async function promptAppleLoginAsync() {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (credential.identityToken) {
        handleLogin('apple', credential.identityToken);
      } else {
        Alert.alert('Apple 로그인 실패', 'ID 토큰을 받지 못했습니다.');
      }
    } catch (e) {
      // 사용자가 취소하면 ERR_REQUEST_CANCELED 코드로 reject됨 — 별도 처리 불필요
      if (e instanceof Error && 'code' in e && e.code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('Apple 로그인 실패', e instanceof Error ? e.message : '알 수 없는 오류');
    }
  }

  // provider별로 실제로는 다른 값(카카오=인가 code, 구글/애플=ID 토큰)이지만 authApi 쪽에서 알맞게 처리함
  async function handleLogin(provider: Provider, credential: string) {
    try {
      setLoading(provider);
      const { access_token, refresh_token } = await (provider === 'kakao'
        ? authApi.loginWithKakao(credential)
        : provider === 'google'
          ? authApi.loginWithGoogle(credential)
          : authApi.loginWithApple(credential));

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
                    <Svg width={13} height={12} viewBox="0 0 24 24">
                      <Path
                        fill="#3C1E1E"
                        d="M12 3C6.582 3 2 6.596 2 11.163c0 2.892 1.804 5.435 4.567 6.978a.32.32 0 0 1 .119.13c.089.184-.017.475-.03.524-.15.518-.588 2.046-.6 2.1-.017.076-.065.29.121.397.187.108.394.032.394.032.24-.037.24-.037 3.28-2.297.284-.04.573-.06.87-.06 5.418 0 10-3.596 10-8.164C21 6.596 16.418 3 12 3"
                      />
                    </Svg>
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

            {/* Sign in with Apple — Android엔 API 자체가 없어 iOS 전용(2026-09-14 추가, 앱스토어
                심사 가이드라인 4.8 대응). 카카오/구글 버튼과 동일한 "기본버튼" 디자인으로 통일
                (Figma 330:1319 — 채널 yxe7x9t0, 2026-09-14 요청) */}
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.button, styles.appleButton]}
                disabled={loading !== null}
                onPress={() => promptAppleLoginAsync()}
              >
                {loading === 'apple' ? (
                  <ActivityIndicator color={colors.gray700} />
                ) : (
                  <>
                    <View style={styles.appleSymbol}>
                      <Svg width={12} height={12} viewBox="0 0 24 24">
                        <Path
                          fill={colors.white}
                          d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.05 3.19-.7.85-1.86 1.51-3 1.42-.15-1.15.41-2.35 1.11-3.11"
                        />
                      </Svg>
                    </View>
                    <Text style={styles.appleButtonText}>Apple 로그인</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

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
  kakaoButtonText: { fontFamily: fonts.regular, fontSize: 16, letterSpacing: -0.4, color: colors.gray700 },
  googleButton: { backgroundColor: colors.black, marginBottom: 8 },
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
  appleButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  appleSymbol: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  appleButtonText: { fontFamily: fonts.regular, fontSize: 16, letterSpacing: -0.4, color: colors.gray700 },
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
