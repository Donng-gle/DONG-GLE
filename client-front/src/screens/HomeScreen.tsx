import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, Modal, Pressable, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserProfile, authApi } from '../api/auth';
import { tokenStorage } from '../auth/tokenStorage';
import { FloatingNav } from '../components/FloatingNav';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { JournalTab } from './home/JournalTab';
import { RecommendedTab } from './home/RecommendedTab';
import { StreetTab } from './home/StreetTab';
import { CourseFlowScreen } from './CourseFlowScreen';
import { CourseManualBuilderScreen } from './CourseManualBuilderScreen';
import { EventsScreen } from './EventsScreen';
import { ExploreScreen } from './ExploreScreen';
import { MyLogsScreen } from './MyLogsScreen';
import { NotificationSettingsScreen } from './NotificationSettingsScreen';
import { PlaceListScreen } from './PlaceListScreen';
import { ProfileScreen } from './ProfileScreen';
import { ScrapbookScreen } from './ScrapbookScreen';
import { TagsScreen } from './TagsScreen';

interface Props {
  profile: UserProfile | null; // null = 게스트 모드
  onLogout: () => void; // 로그인 사용자가 실제로 로그아웃(토큰 정리 포함)할 때
  onRequireLogin: () => void; // 게스트가 로그인이 필요한 기능을 눌렀을 때 로그인 화면으로 돌아감(토큰이 없어 API 호출 없이 바로 전환)
}

type Tab = 'journal' | 'recommended' | 'street';

// 기존 '78%' 퍼센트 너비를 애니메이션(translateX)에 쓰려면 픽셀값이 필요해서 계산.
// 태블릿 등 넓은 화면에서 드로어가 과하게 넓어지지 않게 360으로 상한
const DRAWER_WIDTH = Math.min(360, Dimensions.get('window').width * 0.78);

type Overlay =
  | 'course-flow'
  | 'course-manual'
  | 'scrapbook'
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

// 드로어에서 여는 화면들 — 디자인 시안이 아직 없어서(Figma 79개 프레임 전수 확인 완료, 드로어 전용
// 시안은 없음) 항목 배치는 임시, 실제 서랍(드로어) UI 스펙 나오면 교체 필요.
// '내 코스'/'찜한 장소'는 Figma 노드 485:10903/488:11855("스크랩북")가 탭 하나로 묶여있어 항목도 통합함.
// 섹션 구분은 항목이 8개로 늘어나 그냥 나열하면 훑어보기 어려워서(2026-09-03) 임의로 묶은 것 —
// 디자인 확정 전까지의 임시 구조라는 점은 동일.
// authRequired: 게스트가 누르면 여는 대신 onRequireLogin으로 로그인 화면으로 보냄(백엔드가 인증 필요한
// 엔드포인트라 게스트로 열어봤자 401만 남, SSOT "비인증 허용" 목록에 없는 것 전부 여기 해당)
const DRAWER_SECTIONS: { title: string; items: { key: Overlay; label: string; authRequired?: boolean }[] }[] = [
  {
    title: '코스',
    items: [
      { key: 'course-flow', label: 'AI로 코스 만들기', authRequired: true },
      { key: 'course-manual', label: '직접 코스 만들기', authRequired: true },
      { key: 'scrapbook', label: '스크랩북', authRequired: true },
    ],
  },
  {
    title: '탐색',
    items: [
      { key: 'my-logs', label: '방문 기록', authRequired: true },
      { key: 'events', label: '행사·축제' },
      { key: 'explore', label: '비슷한 취향 탐색', authRequired: true },
    ],
  },
  {
    title: '설정',
    items: [
      { key: 'tags', label: '감성 태그 안내' },
      { key: 'notifications', label: '알림 설정', authRequired: true },
    ],
  },
];

// Figma 노드 506:11115/334:2691/334:3255("메인 페이지-*") 공통 셸 — 상단 GNB + 3개 탭 +
// 하단 플로팅 네비게이션 바. 각 탭 내용은 ./home/*Tab.tsx 참고 (2026-08-31 결정, decision-log 참고)
//
// 좌측 드로어: Figma 79개 프레임 전수 확인해도 전용 시안이 없어서(2026-09-03 확인) 항목 구성은
// 여전히 임시. 다만 UX 기본기(슬라이드 인/아웃 애니메이션, 프로필 아바타, 항목 섹션 구분)는
// 디자인 확정과 무관하게 개선함 (decision-log 참고)
//
// 게스트 모드(2026-09-03 구현, decision-log 참고): profile이 null이면 비로그인 상태.
// SSOT상 비인증 허용 API(장소 탐색/행사·축제/감성 태그)만 그대로 쓸 수 있고, 인증 필요한
// 기능(코스/스크랩북/방문기록/비슷한 취향 탐색/알림설정/프로필)은 눌러도 열지 않고 onRequireLogin으로
// 로그인 화면으로 돌려보냄 — 401을 그냥 겪게 하는 대신 미리 막음
export function HomeScreen({ profile: initialProfile, onLogout, onRequireLogin }: Props) {
  const insets = useSafeAreaInsets();
  // 게스트는 안 볼 수 있는 탭(나의 일지/취향 맞춤 코스)이 아니라 바로 쓸 수 있는 '안동 거리'로 시작
  const [tab, setTab] = useState<Tab>(initialProfile ? 'journal' : 'street');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [profile, setProfile] = useState(initialProfile);
  const drawerAnim = useRef(new Animated.Value(0)).current;

  async function handleLogout() {
    try {
      await authApi.logout();
    } finally {
      await tokenStorage.clear();
      onLogout();
    }
  }

  function openDrawer() {
    drawerAnim.setValue(0);
    setDrawerVisible(true);
  }

  useEffect(() => {
    if (drawerVisible) {
      Animated.timing(drawerAnim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerVisible]);

  function closeDrawer() {
    Animated.timing(drawerAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setDrawerVisible(false));
  }

  function openOverlay(next: Overlay) {
    // 드로어에서 다른 화면으로 완전히 전환되는 경우라 슬라이드 아웃 없이 바로 닫음
    setDrawerVisible(false);
    setOverlay(next);
  }
  const closeOverlay = () => setOverlay(null);

  // 게스트가 인증 필요한 드로어 항목/아이콘을 눌렀을 때 공용으로 씀
  function requireLogin() {
    setDrawerVisible(false);
    onRequireLogin();
  }

  function handleDrawerItemPress(item: { key: Overlay; authRequired?: boolean }) {
    if (item.authRequired && !profile) {
      requireLogin();
      return;
    }
    openOverlay(item.key);
  }

  function handleShare() {
    Share.share({ message: '안동 여행, 동글과 함께 떠나보세요 🌿' }).catch(() => {});
  }

  switch (overlay) {
    case 'course-flow':
      return <CourseFlowScreen onExit={closeOverlay} />;
    case 'course-manual':
      return <CourseManualBuilderScreen onSaved={closeOverlay} onExit={closeOverlay} />;
    case 'scrapbook':
      return <ScrapbookScreen onExit={closeOverlay} />;
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
      // openOverlay('profile')은 profile이 있을 때만 호출되지만(헤더 아이콘 핸들러 참고)
      // profile 상태 자체는 null일 수 있는 타입이라 방어적으로 한 번 더 확인
      return profile ? (
        <ProfileScreen profile={profile} onProfileUpdated={setProfile} onWithdrawn={onLogout} onExit={closeOverlay} />
      ) : null;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 13 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={openDrawer} hitSlop={8} style={styles.iconButton}>
            <HamburgerIcon />
          </TouchableOpacity>
          <Text style={styles.logo}>Dong_Gle</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => openOverlay('places')} hitSlop={8} style={styles.iconButton}>
            <Text style={styles.emojiIcon}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => (profile ? openOverlay('profile') : requireLogin())}
            hitSlop={8}
            style={styles.iconButton}
          >
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
        {tab === 'journal' &&
          (profile ? (
            <JournalTab onOpenLogs={() => openOverlay('my-logs')} />
          ) : (
            <GuestPrompt message="로그인하면 나만의 여행 기록을 지도에 남길 수 있어요" onLogin={requireLogin} />
          ))}
        {tab === 'recommended' &&
          (profile ? (
            <RecommendedTab />
          ) : (
            <GuestPrompt message="로그인하면 내 취향과 비슷한 다른 사람의 여행 기록을 볼 수 있어요" onLogin={requireLogin} />
          ))}
        {tab === 'street' && <StreetTab />}
      </View>

      <FloatingNav onHome={() => setTab('journal')} onShare={handleShare} />

      <Modal visible={drawerVisible} transparent animationType="none" onRequestClose={closeDrawer}>
        <View style={styles.drawerBackdropWrap}>
          <Animated.View style={[styles.drawerBackdrop, { opacity: drawerAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} />
          </Animated.View>
          <Animated.View
            style={[
              styles.drawerPanel,
              { paddingTop: insets.top + 20 },
              {
                transform: [
                  {
                    translateX: drawerAnim.interpolate({ inputRange: [0, 1], outputRange: [-DRAWER_WIDTH, 0] }),
                  },
                ],
              },
            ]}
          >
            {profile ? (
              <View style={styles.drawerProfileRow}>
                {profile.profile_image_url ? (
                  <Image source={{ uri: profile.profile_image_url }} style={styles.drawerAvatar} resizeMode="cover" />
                ) : (
                  <View style={[styles.drawerAvatar, styles.drawerAvatarPlaceholder]} />
                )}
                <View>
                  <Text style={styles.drawerGreeting}>{profile.nickname}님</Text>
                  <Text style={styles.drawerMeta}>
                    {profile.oauth_provider} 로그인 · 온보딩 {profile.has_onboarded ? '완료' : '미완료'}
                  </Text>
                </View>
              </View>
            ) : (
              <View>
                <Text style={styles.drawerGreeting}>게스트로 둘러보는 중</Text>
                <Text style={styles.drawerMeta}>로그인하면 찜, 코스 저장, 방문 기록을 모두 이용할 수 있어요</Text>
              </View>
            )}
            <View style={styles.drawerDivider} />
            {DRAWER_SECTIONS.map((section) => (
              <View key={section.title} style={styles.drawerSection}>
                <Text style={styles.drawerSectionTitle}>{section.title}</Text>
                {section.items.map((item) => {
                  const locked = item.authRequired && !profile;
                  return (
                    <TouchableOpacity key={item.key} style={styles.drawerItem} onPress={() => handleDrawerItemPress(item)}>
                      <Text style={[styles.drawerItemText, locked && styles.drawerItemTextLocked]}>{item.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            <View style={styles.drawerDivider} />
            {profile ? (
              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => {
                  setDrawerVisible(false);
                  handleLogout();
                }}
              >
                <Text style={[styles.drawerItemText, styles.drawerLogoutText]}>로그아웃</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.drawerItem} onPress={requireLogin}>
                <Text style={styles.drawerItemText}>로그인하기</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

// 게스트가 인증 필요한 탭(나의 일지/취향 맞춤 코스)을 눌렀을 때 대신 보여줄 화면.
// 실제 API 호출 없이 안내 문구 + 로그인 버튼만 — 401을 그냥 삼키는 대신 왜 안 보이는지 설명함
function GuestPrompt({ message, onLogin }: { message: string; onLogin: () => void }) {
  return (
    <View style={styles.guestPrompt}>
      <Text style={styles.guestPromptText}>{message}</Text>
      <TouchableOpacity style={styles.guestPromptButton} onPress={onLogin}>
        <Text style={styles.guestPromptButtonText}>로그인하기</Text>
      </TouchableOpacity>
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
  drawerBackdropWrap: { flex: 1 },
  drawerBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  drawerPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  drawerProfileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  drawerAvatar: { width: 44, height: 44, borderRadius: 22 },
  drawerAvatarPlaceholder: { backgroundColor: colors.border },
  drawerGreeting: { fontFamily: fonts.semiBold, fontSize: 18, letterSpacing: -0.5, color: colors.black },
  drawerMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray500, marginTop: 4 },
  drawerDivider: { height: 1, backgroundColor: colors.divider, marginVertical: 16 },
  drawerSection: { marginBottom: 8 },
  drawerSectionTitle: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.4, color: colors.gray400, marginBottom: 4 },
  drawerItem: { paddingVertical: 12 },
  drawerItemText: { fontFamily: fonts.medium, fontSize: 15, letterSpacing: -0.4, color: colors.black },
  drawerItemTextLocked: { color: colors.gray400 },
  drawerLogoutText: { color: colors.gray500 },
  guestPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  guestPromptText: { fontFamily: fonts.regular, fontSize: 14, color: colors.gray700, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  guestPromptButton: { height: 44, paddingHorizontal: 24, borderRadius: 8, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  guestPromptButtonText: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.white },
});
