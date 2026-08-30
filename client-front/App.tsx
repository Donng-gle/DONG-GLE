import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { UserProfile, authApi } from './src/api/auth';
import { tokenStorage } from './src/auth/tokenStorage';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';

export default function App() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    restoreSession();
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

  if (checkingSession) {
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
