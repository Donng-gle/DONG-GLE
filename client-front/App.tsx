import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { UserProfile, authApi } from './src/api/auth';
import { ApiError, registerSessionExpiredListener } from './src/api/client';
import { tokenStorage } from './src/auth/tokenStorage';
import { SplashLogo } from './src/components/SplashLogo';
import { colors } from './src/theme/colors';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';

export default function App() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  // 로고 팝업 애니메이션(SplashLogo)이 다 끝났는지 — 세션 확인/폰트 로딩이 애니메이션보다 먼저
  // 끝나도 애니메이션이 잘리지 않게 이것도 같이 게이트에 물림(2026-09-11 추가, Figma "로그인-앱시작"
  // 프레임 재현, 사용자 확인)
  const [splashAnimDone, setSplashAnimDone] = useState(false);
  // Figma 디자인 전체가 Pretendard 기준이라 앱 진입점에서 한 번만 로드 (2026-08-31 결정, decision-log 참고)
  const [fontsLoaded] = useFonts({
    'Pretendard-Regular': require('./assets/fonts/Pretendard-Regular.ttf'),
    'Pretendard-Medium': require('./assets/fonts/Pretendard-Medium.ttf'),
    'Pretendard-SemiBold': require('./assets/fonts/Pretendard-SemiBold.ttf'),
    'Pretendard-Bold': require('./assets/fonts/Pretendard-Bold.ttf'),
    'SquadaOne-Regular': require('./assets/fonts/SquadaOne-Regular.ttf'),
  });

  useEffect(() => {
    restoreSession();

    // 액세스 토큰 갱신까지 실패하면(리프레시 토큰 만료/무효) apiClient가 이걸 호출 —
    // 화면 어디에 있든 자동으로 로그인 화면으로 돌려보냄 (api/client.ts 참고)
    registerSessionExpiredListener(() => setProfile(null));
    return () => registerSessionExpiredListener(null);
  }, []);

  async function restoreSession() {
    const accessToken = await tokenStorage.getAccessToken();
    if (!accessToken) {
      setCheckingSession(false);
      return;
    }

    // Render 서버가 잠들어 있으면 깨는 데 최대 1~2분 걸려서 /users/me가 네트워크 오류로 실패할 수
    // 있음. 예전엔 이런 일시적 실패까지 세션 만료로 취급해 토큰을 지워버려서, 서버가 콜드스타트인
    // 타이밍에 앱을 열면 멀쩡한 로그인이 날아가고 카카오 동의 화면부터 매번 다시 봐야 했음
    // (2026-09-21 사용자 리포트). 실제 인증 실패(401)일 때만 지우고, 그 외엔 몇 번 재시도한다.
    const retryDelaysMs = [0, 3000, 8000, 15000];
    for (const delay of retryDelaysMs) {
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        setProfile(await authApi.me());
        setCheckingSession(false);
        return;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          await tokenStorage.clear();
          break;
        }
      }
    }
    setCheckingSession(false);
  }

  if (checkingSession || !fontsLoaded || !splashAnimDone) {
    return (
      <SafeAreaProvider>
        <View style={styles.center}>
          {/* 폰트(Squada One) 로딩 전엔 로고를 그 폰트로 못 그리니 잠깐 빈 흰 화면만 보여줌 —
              Figma 시안도 첫 프레임 전엔 그냥 흰 배경이라 스피너보다 이쪽이 더 시안에 가까움 */}
          {fontsLoaded && <SplashLogo onFinish={() => setSplashAnimDone(true)} />}
          <StatusBar style="dark" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        {profile ? (
          profile.has_onboarded ? (
            <HomeScreen
              profile={profile}
              onLogout={() => setProfile(null)}
              onRequireLogin={() => setProfile(null)}
              // 마이페이지 "취향 재검사" — has_onboarded를 false로 내리면 아래 분기가 OnboardingScreen을 다시 태움
              onRetakeOnboarding={() => setProfile({ ...profile, has_onboarded: false })}
            />
          ) : (
            <OnboardingScreen onComplete={() => setProfile({ ...profile, has_onboarded: true })} />
          )
        ) : isGuest ? (
          // 게스트는 토큰 자체가 없어서 onLogout(profile을 null로만)이 곧 로그인 화면 복귀와 같음.
          // ProfileScreen(따라서 취향 재검사)은 게스트가 못 여는 화면이라(HomeScreen이 openOverlay 대신
          // onRequireLogin으로 돌려보냄) onRetakeOnboarding은 절대 호출 안 되지만 prop은 필수라 no-op으로 채움
          <HomeScreen
            profile={null}
            onLogout={() => setIsGuest(false)}
            onRequireLogin={() => setIsGuest(false)}
            onRetakeOnboarding={() => {}}
          />
        ) : (
          <LoginScreen onLoginSuccess={setProfile} onGuestContinue={() => setIsGuest(true)} />
        )}
        <StatusBar style="auto" />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
});
