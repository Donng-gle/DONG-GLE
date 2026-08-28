import { Button, StyleSheet, Text, View } from 'react-native';
import { UserProfile, authApi } from '../api/auth';
import { tokenStorage } from '../auth/tokenStorage';

interface Props {
  profile: UserProfile;
  onLogout: () => void;
}

export function HomeScreen({ profile, onLogout }: Props) {
  async function handleLogout() {
    try {
      await authApi.logout();
    } finally {
      await tokenStorage.clear();
      onLogout();
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>{profile.nickname}님, 안녕하세요 👋</Text>
      <Text style={styles.meta}>
        {profile.oauth_provider} 로그인 · 온보딩 {profile.has_onboarded ? '완료' : '미완료'}
      </Text>
      <View style={styles.gap} />
      <Button title="로그아웃" onPress={handleLogout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 24 },
  greeting: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  meta: { fontSize: 13, color: '#666' },
  gap: { height: 32 },
});
