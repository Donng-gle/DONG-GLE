import { useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserProfile, authApi } from '../api/auth';
import { tokenStorage } from '../auth/tokenStorage';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { JournalTab } from './home/JournalTab';
import { RecommendedTab } from './home/RecommendedTab';
import { StreetTab } from './home/StreetTab';
import { CourseFlowScreen } from './CourseFlowScreen';
import { CourseManualBuilderScreen } from './CourseManualBuilderScreen';
import { EventsScreen } from './EventsScreen';
import { ExploreScreen } from './ExploreScreen';
import { LikesScreen } from './LikesScreen';
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

type Tab = 'journal' | 'recommended' | 'street';

type Overlay =
  | 'course-flow'
  | 'course-manual'
  | 'my-courses'
  | 'likes'
  | 'places'
  | 'my-logs'
  | 'events'
  | 'explore'
  | 'tags'
  | 'notifications'
  | 'profile';

const TABS: { key: Tab; label: string }[] = [
  { key: 'journal', label: '나의 일지' },
  { key: 'recommended', label: '취향 맞춤 코스' },
  { key: 'street', label: '안동 거리' },
];

// 드로어에서 여는 화면들 — 디자인 시안이 아직 없어서 항목 배치는 임시(전체 메뉴 목록 성격),
// 실제 서랍(드로어) UI 스펙 나오면 교체 필요
const DRAWER_ITEMS: { key: Overlay; label: string }[] = [
  { key: 'course-flow', label: 'AI로 코스 만들기' },
  { key: 'course-manual', label: '직접 코스 만들기' },
  { key: 'my-courses', label: '내 코스' },
  { key: 'likes', label: '찜한 장소' },
  { key: 'my-logs', label: '방문 기록' },
  { key: 'events', label: '행사·축제' },
  { key: 'explore', label: '비슷한 취향 탐색' },
  { key: 'tags', label: '감성 태그 안내' },
  { key: 'notifications', label: '알림 설정' },
];

// Figma 노드 506:11115/334:2691/334:3255("메인 페이지-*") 공통 셸 — 상단 GNB + 3개 탭 +
// 하단 플로팅 네비게이션 바. 각 탭 내용은 ./home/*Tab.tsx 참고 (2026-08-31 결정, decision-log 참고)
export function HomeScreen({ profile: initialProfile, onLogout }: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('journal');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [profile, setProfile] = useState(initialProfile);

  async function handleLogout() {
    try {
      await authApi.logout();
    } finally {
      await tokenStorage.clear();
      onLogout();
    }
  }

  function openOverlay(next: Overlay) {
    setDrawerOpen(false);
    setOverlay(next);
  }
  const closeOverlay = () => setOverlay(null);

  function handleShare() {
    Share.share({ message: '안동 여행, 동글과 함께 떠나보세요 🌿' }).catch(() => {});
  }

  switch (overlay) {
    case 'course-flow':
      return <CourseFlowScreen onExit={closeOverlay} />;
    case 'course-manual':
      return <CourseManualBuilderScreen onSaved={closeOverlay} onExit={closeOverlay} />;
    case 'my-courses':
      return <MyCoursesScreen onExit={closeOverlay} />;
    case 'likes':
      return <LikesScreen onExit={closeOverlay} />;
    case 'places':
      return <PlaceListScreen onExit={closeOverlay} />;
    case 'my-logs':
      return <MyLogsScreen onExit={closeOverlay} />;
    case 'events':
      return <EventsScreen onExit={closeOverlay} />;
    case 'explore':
      return <ExploreScreen onExit={closeOverlay} />;
    case 'tags':
      return <TagsScreen onExit={closeOverlay} />;
    case 'notifications':
      return <NotificationSettingsScreen onExit={closeOverlay} />;
    case 'profile':
      return (
        <ProfileScreen profile={profile} onProfileUpdated={setProfile} onWithdrawn={onLogout} onExit={closeOverlay} />
      );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 13 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => setDrawerOpen(true)} hitSlop={8} style={styles.iconButton}>
            <HamburgerIcon />
          </TouchableOpacity>
          <Text style={styles.logo}>Dong_Gle</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => openOverlay('places')} hitSlop={8} style={styles.iconButton}>
            <Text style={styles.emojiIcon}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openOverlay('profile')} hitSlop={8} style={styles.iconButton}>
            <ProfileIcon />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} style={styles.tabItem}>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
            {tab === t.key && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.tabContent}>
        {tab === 'journal' && <JournalTab onOpenLogs={() => openOverlay('my-logs')} />}
        {tab === 'recommended' && <RecommendedTab />}
        {tab === 'street' && <StreetTab />}
      </View>

      <View style={[styles.floatingNav, { bottom: Math.max(20, insets.bottom + 12) }]}>
        <TouchableOpacity style={styles.floatingNavSideButton} hitSlop={6}>
          <Text style={styles.emojiIcon}>🏠</Text>
        </TouchableOpacity>
        <View style={styles.floatingNavCenterSpacer} />
        <TouchableOpacity style={styles.floatingNavSideButton} onPress={handleShare} hitSlop={6}>
          <Text style={styles.emojiIcon}>📤</Text>
        </TouchableOpacity>
        <LinearGradient
          colors={['#ffe500', '#f79030']}
          style={styles.floatingNavCenter}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.emojiIcon}>🏠</Text>
        </LinearGradient>
      </View>

      <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
        <Pressable style={styles.drawerBackdrop} onPress={() => setDrawerOpen(false)}>
          <Pressable style={[styles.drawerPanel, { paddingTop: insets.top + 20 }]} onPress={() => {}}>
            <Text style={styles.drawerGreeting}>{profile.nickname}님</Text>
            <Text style={styles.drawerMeta}>
              {profile.oauth_provider} 로그인 · 온보딩 {profile.has_onboarded ? '완료' : '미완료'}
            </Text>
            <View style={styles.drawerDivider} />
            {DRAWER_ITEMS.map((item) => (
              <TouchableOpacity key={item.key} style={styles.drawerItem} onPress={() => openOverlay(item.key)}>
                <Text style={styles.drawerItemText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.drawerDivider} />
            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => {
                setDrawerOpen(false);
                handleLogout();
              }}
            >
              <Text style={[styles.drawerItemText, styles.drawerLogoutText]}>로그아웃</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function HamburgerIcon() {
  return (
    <View style={hamburgerStyles.stack}>
      <View style={hamburgerStyles.bar} />
      <View style={hamburgerStyles.bar} />
      <View style={hamburgerStyles.bar} />
    </View>
  );
}

const hamburgerStyles = StyleSheet.create({
  stack: { width: 20, height: 14, justifyContent: 'space-between' },
  bar: { height: 2, borderRadius: 1, backgroundColor: colors.black },
});

// Figma 아이콘 벡터(Ellipse+Rectangle) 그대로 단순 도형으로 재현 — 별도 아이콘 에셋 없이 구현
function ProfileIcon() {
  return (
    <View style={profileIconStyles.container}>
      <View style={profileIconStyles.head} />
      <View style={profileIconStyles.shoulders} />
    </View>
  );
}

const profileIconStyles = StyleSheet.create({
  container: { width: 20, height: 20, alignItems: 'center' },
  head: { width: 7, height: 7, borderRadius: 3.5, borderWidth: 1.3, borderColor: colors.black, marginBottom: 2 },
  shoulders: {
    width: 18,
    height: 8,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderWidth: 1.3,
    borderColor: colors.black,
    borderBottomWidth: 0,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 13,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  emojiIcon: { fontSize: 18 },
  logo: { fontFamily: fonts.logo, fontSize: 24, color: colors.black },
  tabRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 20 },
  tabItem: { paddingVertical: 8 },
  tabLabel: { fontFamily: fonts.regular, fontSize: 16, letterSpacing: -0.4, color: colors.gray700 },
  tabLabelActive: { fontFamily: fonts.semiBold, color: colors.black },
  tabUnderline: { height: 2, backgroundColor: colors.black, marginTop: 6, borderRadius: 1 },
  tabContent: { flex: 1 },
  floatingNav: {
    position: 'absolute',
    alignSelf: 'center',
    width: 209,
    height: 52,
    borderRadius: 100,
    backgroundColor: 'rgba(17,17,17,0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  floatingNavSideButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  floatingNavCenterSpacer: { width: 52 },
  floatingNavCenter: {
    position: 'absolute',
    top: -14,
    left: '50%',
    marginLeft: -26,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', flexDirection: 'row' },
  drawerPanel: {
    width: '78%',
    height: '100%',
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  drawerGreeting: { fontFamily: fonts.semiBold, fontSize: 18, letterSpacing: -0.5, color: colors.black },
  drawerMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray500, marginTop: 4 },
  drawerDivider: { height: 1, backgroundColor: colors.divider, marginVertical: 16 },
  drawerItem: { paddingVertical: 12 },
  drawerItemText: { fontFamily: fonts.medium, fontSize: 15, letterSpacing: -0.4, color: colors.black },
  drawerLogoutText: { color: colors.gray500 },
});
