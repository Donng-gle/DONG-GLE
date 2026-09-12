import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserProfile, authApi } from '../api/auth';
import { tokenStorage } from '../auth/tokenStorage';
import { AppHeader } from '../components/AppHeader';
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
import { PlaceListScreen } from './PlaceListScreen';
import { ProfileScreen } from './ProfileScreen';
import { PublicCourseDetailScreen } from './PublicCourseDetailScreen';
import { ScrapbookScreen } from './ScrapbookScreen';
import { SearchScreen } from './SearchScreen';

interface Props {
  profile: UserProfile | null; // null = 게스트 모드
  onLogout: () => void; // 로그인 사용자가 실제로 로그아웃(토큰 정리 포함)할 때
  onRequireLogin: () => void; // 게스트가 로그인이 필요한 기능을 눌렀을 때 로그인 화면으로 돌아감(토큰이 없어 API 호출 없이 바로 전환)
  // 마이페이지 "취향 재검사" — App.tsx가 profile.has_onboarded를 false로 내려서 OnboardingScreen을 다시 태움
  onRetakeOnboarding: () => void;
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
      // 실제 푸시 발송(fcm_token/expo-notifications)이 아직 미도입이라(api/user.ts 참고) 화면을
      // 열어봤자 설정값만 저장되고 아무 효과가 없음 — 오해 방지를 위해 로그인 여부와 무관하게
      // "준비 중" 안내만 띄우도록 함(2026-09-12, 사용자 요청). NotificationSettingsScreen 자체는
      // 지우지 않고 남겨둠 — 푸시 연동되면 이 authRequired만 되돌리고 handleDrawerItemPress의
      // 분기만 제거하면 바로 재사용 가능
      { key: 'notifications', label: '알림 설정', authRequired: false },
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
export function HomeScreen({ profile: initialProfile, onLogout, onRequireLogin, onRetakeOnboarding }: Props) {
  const insets = useSafeAreaInsets();
  // 게스트는 안 볼 수 있는 탭(나의 일지/취향 맞춤 코스)이 아니라 바로 쓸 수 있는 '안동 거리'로 시작
  const [tab, setTab] = useState<Tab>(initialProfile ? 'journal' : 'street');
  const [drawerVisible, setDrawerVisible] = useState(false);
  // 검색은 다른 오버레이들과 달리 화면 전체를 갈아치우지 않고 현재 화면(지도 등) 위에 얹히는
  // 투명 Modal로 띄움(2026-09-07 결정, decision-log 참고 — Figma 시안이 뒷배경에 원래 화면이
  // 비치는 오버레이 형태라 드로어(Modal transparent)와 같은 패턴을 재사용) — 그래서 overlay
  // 유니온과 별개의 boolean 상태
  const [searchVisible, setSearchVisible] = useState(false);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  // "취향 맞춤 코스" 탭 "자세히 보기"(RecommendedTab) — overlay 유니온과 별개로 둔 이유는 courseId를
  // 실어야 해서(2026-09-10 추가, 사용자 지적 — 예전엔 RecommendedTab 로컬 state로만 화면을 바꿔서
  // AppHeader/탭바가 위에 그대로 남아있는 "팝업"처럼 보였음. course-manual과 동일하게 여기서 전체
  // 화면으로 띄움)
  const [courseDetailId, setCourseDetailId] = useState<number | null>(null);
  const [profile, setProfile] = useState(initialProfile);
  const drawerAnim = useRef(new Animated.Value(0)).current;

  // 서버 로그아웃 호출(authApi.logout)이 느리거나 응답이 없으면 이 함수가 await에 걸려서
  // "로그아웃 버튼을 눌러도 아무 반응이 없는" 것처럼 보였음(2026-09-12, 사용자 리포트) — 클라이언트
  // 로그아웃(토큰 삭제+화면 전환)은 서버 응답을 기다릴 이유가 없으므로 먼저 즉시 처리하고, 서버
  // 쪽 로그아웃(리프레시 토큰 폐기 등)은 best-effort로 백그라운드에서 시도만 함
  function handleLogout() {
    onLogout();
    tokenStorage.clear().catch(() => {});
    authApi.logout().catch(() => {});
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
    if (item.key === 'notifications') {
      setDrawerVisible(false);
      Alert.alert('준비 중인 기능이에요', '알림 설정은 아직 지원하지 않아요.');
      return;
    }
    if (item.authRequired && !profile) {
      requireLogin();
      return;
    }
    openOverlay(item.key);
  }

  // FloatingNav 중앙 "일정 생성" 바텀시트의 두 옵션 — 드로어 항목(course-flow/course-manual)과
  // 동일한 게스트 가드(handleDrawerItemPress)를 그대로 재사용(2026-09-06 추가, decision-log 참고)
  const openCreateManual = () => handleDrawerItemPress({ key: 'course-manual', authRequired: true });
  const openCreateAI = () => handleDrawerItemPress({ key: 'course-flow', authRequired: true });
  const openProfile = () => (profile ? openOverlay('profile') : requireLogin());

  if (courseDetailId != null) {
    return (
      <PublicCourseDetailScreen
        courseId={courseDetailId}
        onExit={() => setCourseDetailId(null)}
        onCreateManual={openCreateManual}
        onCreateAI={openCreateAI}
        onProfile={openProfile}
      />
    );
  }

  switch (overlay) {
    case 'course-flow':
      // course-manual과 동일하게 결과 화면의 FloatingNav용으로 전달(2026-09-10, CourseResultScreen
      // Figma 실측 반영 참고)
      return (
        <CourseFlowScreen
          onExit={closeOverlay}
          onCreateManual={openCreateManual}
          onCreateAI={openCreateAI}
          onProfile={openProfile}
        />
      );
    case 'course-manual':
      // Figma 501:12543/501:12088 반영(2026-09-06) 후 이 화면도 FloatingNav를 직접 그려서
      // ScrapbookScreen/ProfileScreen과 동일하게 openCreateManual/openCreateAI/openProfile 전달
      return (
        <CourseManualBuilderScreen
          onSaved={closeOverlay}
          onExit={closeOverlay}
          onCreateManual={openCreateManual}
          onCreateAI={openCreateAI}
          onProfile={openProfile}
        />
      );
    case 'scrapbook':
      return (
        <ScrapbookScreen
          onExit={closeOverlay}
          onCreateManual={openCreateManual}
          onCreateAI={openCreateAI}
          onProfile={openProfile}
        />
      );
    case 'places':
      return <PlaceListScreen onExit={closeOverlay} />;
    case 'my-logs':
      return <MyLogsScreen onExit={closeOverlay} />;
    case 'events':
      return <EventsScreen onExit={closeOverlay} />;
    case 'explore':
      return <ExploreScreen onExit={closeOverlay} />;
    case 'profile':
      // openOverlay('profile')은 profile이 있을 때만 호출되지만(헤더 아이콘 핸들러 참고)
      // profile 상태 자체는 null일 수 있는 타입이라 방어적으로 한 번 더 확인
      return profile ? (
        <ProfileScreen
          profile={profile}
          onProfileUpdated={setProfile}
          onWithdrawn={onLogout}
          onExit={closeOverlay}
          onRetakeOnboarding={onRetakeOnboarding}
          onCreateManual={openCreateManual}
          onCreateAI={openCreateAI}
        />
      ) : null;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <AppHeader
        onMenuPress={openDrawer}
        onSearchPress={() => setSearchVisible(true)}
        onProfilePress={() => (profile ? openOverlay('profile') : requireLogin())}
      />

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
            <RecommendedTab onOpenCourseDetail={setCourseDetailId} />
          ) : (
            <GuestPrompt message="로그인하면 내 취향과 비슷한 다른 사람의 여행 기록을 볼 수 있어요" onLogin={requireLogin} />
          ))}
        {tab === 'street' && <StreetTab />}
      </View>

      <FloatingNav
        onHome={() => setTab('journal')}
        onCreateManual={openCreateManual}
        onCreateAI={openCreateAI}
        onProfile={openProfile}
      />

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

      <Modal visible={searchVisible} transparent animationType="none" onRequestClose={() => setSearchVisible(false)}>
        <SearchScreen onExit={() => setSearchVisible(false)} />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
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
