import { useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { UserProfile, authApi } from '../api/auth';
import { tokenStorage } from '../auth/tokenStorage';
import { CourseFlowScreen } from './CourseFlowScreen';
import { EventsScreen } from './EventsScreen';
import { ExploreScreen } from './ExploreScreen';
import { MyCoursesScreen } from './MyCoursesScreen';
import { MyLogsScreen } from './MyLogsScreen';
import { NotificationSettingsScreen } from './NotificationSettingsScreen';
import { PlaceListScreen } from './PlaceListScreen';
import { ProfileScreen } from './ProfileScreen';
import { TagsScreen } from './TagsScreen';

interface Props {
  profile: UserProfile;
  onLogout: () => void;
}

type Screen =
  | 'home'
  | 'course-flow'
  | 'my-courses'
  | 'places'
  | 'my-logs'
  | 'events'
  | 'explore'
  | 'tags'
  | 'notifications'
  | 'profile';

// 디자인 시안이 아직 없어서 메뉴 형태(버튼 목록)로만 구성 — 각 화면으로의 요청/응답 연결 자체가 목적
export function HomeScreen({ profile: initialProfile, onLogout }: Props) {
  const [screen, setScreen] = useState<Screen>('home');
  const [profile, setProfile] = useState(initialProfile);

  async function handleLogout() {
    try {
      await authApi.logout();
    } finally {
      await tokenStorage.clear();
      onLogout();
    }
  }

  const exit = () => setScreen('home');

  switch (screen) {
    case 'course-flow':
      return <CourseFlowScreen onExit={exit} />;
    case 'my-courses':
      return <MyCoursesScreen onExit={exit} />;
    case 'places':
      return <PlaceListScreen onExit={exit} />;
    case 'my-logs':
      return <MyLogsScreen onExit={exit} />;
    case 'events':
      return <EventsScreen onExit={exit} />;
    case 'explore':
      return <ExploreScreen onExit={exit} />;
    case 'tags':
      return <TagsScreen onExit={exit} />;
    case 'notifications':
      return <NotificationSettingsScreen onExit={exit} />;
    case 'profile':
      return (
        <ProfileScreen
          profile={profile}
          onProfileUpdated={setProfile}
          onWithdrawn={onLogout}
          onExit={exit}
        />
      );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>{profile.nickname}님, 안녕하세요 👋</Text>
      <Text style={styles.meta}>
        {profile.oauth_provider} 로그인 · 온보딩 {profile.has_onboarded ? '완료' : '미완료'}
      </Text>

      <View style={styles.buttons}>
        <Button title="코스 만들기" onPress={() => setScreen('course-flow')} />
        <View style={styles.gap} />
        <Button title="내 코스" onPress={() => setScreen('my-courses')} />
        <View style={styles.gap} />
        <Button title="장소 둘러보기" onPress={() => setScreen('places')} />
        <View style={styles.gap} />
        <Button title="내 방문 기록" onPress={() => setScreen('my-logs')} />
        <View style={styles.gap} />
        <Button title="행사·축제" onPress={() => setScreen('events')} />
        <View style={styles.gap} />
        <Button title="비슷한 취향 탐색" onPress={() => setScreen('explore')} />
        <View style={styles.gap} />
        <Button title="감성 태그 안내" onPress={() => setScreen('tags')} />
        <View style={styles.gap} />
        <Button title="알림 설정" onPress={() => setScreen('notifications')} />
        <View style={styles.gap} />
        <Button title="내 정보" onPress={() => setScreen('profile')} />
        <View style={styles.gapLarge} />
        <Button title="로그아웃" onPress={handleLogout} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingTop: 48, alignItems: 'center' },
  greeting: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  meta: { fontSize: 13, color: '#666', marginBottom: 32 },
  buttons: { width: '100%' },
  gap: { height: 12 },
  gapLarge: { height: 32 },
});
