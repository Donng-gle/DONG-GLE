import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { UserProfile, authApi } from './src/api/auth';
import { registerSessionExpiredListener } from './src/api/client';
import { tokenStorage } from './src/auth/tokenStorage';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';

export default function App() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // Figma 디자인 전체가 Pretendard 기준이라 앱 진입점에서 한 번만 로드 (2026-08-31 결정, decision-log 참고)
  const [fontsLoaded] = useFonts({
    'Pretendard-Regular': require('./assets/fonts/Pretendard-Regular.ttf'),
    'Pretendard-Medium': require('./assets/fonts/Pretendard-Medium.ttf'),
    'Pretendard-SemiBold': require('./assets/fonts/Pretendard-SemiBold.ttf'),
    'Pretendard-Bold': require('./assets/fonts/Pretendard-Bold.ttf'),
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

    try {
      setProfile(await authApi.me());
    } catch {
      await tokenStorage.clear();
    } finally {
      setCheckingSession(false);
    }
  }

  if (checkingSession || !fontsLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {profile ? (
        profile.has_onboarded ? (
          <HomeScreen profile={profile} onLogout={() => setProfile(null)} />
        ) : (
          <OnboardingScreen onComplete={() => setProfile({ ...profile, has_onboarded: true })} />
        )
      ) : (
        <LoginScreen onLoginSuccess={setProfile} />
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
