import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { UserProfile, authApi } from '../api/auth';
import { tokenStorage } from '../auth/tokenStorage';
import { CourseFlowScreen } from './CourseFlowScreen';
import { MyCoursesScreen } from './MyCoursesScreen';

interface Props {
  profile: UserProfile;
  onLogout: () => void;
}

type Screen = 'home' | 'course-flow' | 'my-courses';

export function HomeScreen({ profile, onLogout }: Props) {
  const [screen, setScreen] = useState<Screen>('home');

  async function handleLogout() {
    try {
      await authApi.logout();
    } finally {
      await tokenStorage.clear();
      onLogout();
    }
  }

  if (screen === 'course-flow') {
    return <CourseFlowScreen onExit={() => setScreen('home')} />;
  }

  if (screen === 'my-courses') {
    return <MyCoursesScreen onExit={() => setScreen('home')} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>{profile.nickname}님, 안녕하세요 👋</Text>
      <Text style={styles.meta}>
        {profile.oauth_provider} 로그인 · 온보딩 {profile.has_onboarded ? '완료' : '미완료'}
      </Text>
      <View style={styles.gap} />
      <Button title="코스 만들기" onPress={() => setScreen('course-flow')} />
      <View style={styles.gapSmall} />
      <Button title="내 코스" onPress={() => setScreen('my-courses')} />
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
  gapSmall: { height: 12 },
});
