import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { UserProfile } from '../api/auth';
import { UserPreferenceTag, userApi } from '../api/user';
import { tokenStorage } from '../auth/tokenStorage';
import { AppHeader } from '../components/AppHeader';
import { FloatingNav } from '../components/FloatingNav';
import { ChevronRightIcon, ProfileIcon } from '../components/icons';
import { RadarChart } from '../components/RadarChart';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { ScrapbookScreen } from './ScrapbookScreen';

interface Props {
  profile: UserProfile;
  onProfileUpdated: (profile: UserProfile) => void;
  onWithdrawn: () => void;
  onExit: () => void;
  // "취향 재검사" — App.tsx가 profile.has_onboarded를 false로 내려서 OnboardingScreen을 다시 태움
  onRetakeOnboarding: () => void;
}

type SubScreen = 'none' | 'likes';

const PROVIDER_LABEL: Record<UserProfile['oauth_provider'], string> = {
  kakao: '카카오 사용자',
  google: '구글 사용자',
};

// Figma "마이페이지"(598:13735, 2026-09-06 새로 확인) — 그래프+재검사 버튼 아래 "문의" 박스가
// 항목 1개(고객센터)에서 4개로 늘어남. 넷 다 실제 연결할 화면/API가 아직 없어서(ssot.md 기능
// 목록에도 없음 — 쇼핑몰 UI 키트에서 그대로 가져온 문구로 보임, "상품 문의 내역" 등 이 서비스와
// 안 맞는 항목도 있어서 사용자에게 알려둠) 탭하면 "준비 중" 안내만 뜨게 해둠
const INQUIRY_ITEMS = ['고객센터', '1:1 문의 내역', '상품 문의 내역', '공지사항'];

// Figma "메인 페이지-마이페이지" 프레임 반영 — 프로필 카드 + 취향 레이더 차트(7각형) + 취향 재검사
// 버튼. 헤더/하단 네비는 다른 "메인 페이지-*" 화면들과 동일한 걸 그대로 씀(AppHeader/FloatingNav
// 공용 컴포넌트, 2026-09-05에 HomeScreen에서 뽑아냄). 이 화면엔 HomeScreen 같은 드로어/검색
// 오버레이 상태가 따로 없어서 헤더의 메뉴/검색/프로필 아이콘은 전부 onExit(뒤로 가기)에 연결해둠 —
// 실제 드로어를 여기서도 열고 싶으면 나중에 상태를 끌어올리거나 Context로 빼야 함
export function ProfileScreen({ profile, onProfileUpdated, onWithdrawn, onExit, onRetakeOnboarding }: Props) {
  const [nickname, setNickname] = useState(profile.nickname);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferenceTag[] | null>(null);
  const [subScreen, setSubScreen] = useState<SubScreen>('none');

  useEffect(() => {
    userApi
      .getPreferences()
      .then((response) => setPreferences(response.preferences))
      .catch(() => setPreferences([]));
  }, []);

  async function handleSave() {
    if (!nickname.trim()) return;
    setSaving(true);
    try {
      const updated = await userApi.updateProfile({ nickname: nickname.trim() });
      onProfileUpdated(updated);
      setEditing(false);
    } catch (e) {
      Alert.alert('저장에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setSaving(false);
    }
  }

  function confirmWithdraw() {
    Alert.alert('정말 탈퇴하시겠어요?', '방문 기록, 찜, 저장한 코스가 모두 삭제되며 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      { text: '탈퇴', style: 'destructive', onPress: handleWithdraw },
    ]);
  }

  async function handleWithdraw() {
    setWithdrawing(true);
    try {
      await userApi.withdraw();
      await tokenStorage.clear();
      onWithdrawn();
    } catch (e) {
      Alert.alert('탈퇴에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
      setWithdrawing(false);
    }
  }

  function confirmRetakeOnboarding() {
    Alert.alert('취향을 다시 분석할까요?', '스와이프를 처음부터 다시 진행해요.', [
      { text: '취소', style: 'cancel' },
      { text: '다시 검사', onPress: onRetakeOnboarding },
    ]);
  }

  function handleInquiryPress(label: string) {
    Alert.alert(label, '아직 준비 중인 기능이에요.');
  }

  if (subScreen === 'likes') {
    return <ScrapbookScreen initialTab="place" onExit={() => setSubScreen('none')} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <AppHeader onMenuPress={onExit} onSearchPress={onExit} onProfilePress={onExit} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileCard}>
          {/* 별도 "프로필 수정" 버튼 대신 프로필(아바타+닉네임) 영역을 누르면 바로 수정 모드로
              들어가도록 변경(2026-09-06 사용자 요청) — 편집 중엔 다시 눌러도 아무 효과 없게
              disabled 처리(입력 중 재진입으로 포커스가 튀는 걸 방지) */}
          <TouchableOpacity
            style={styles.profileRow}
            onPress={() => setEditing(true)}
            disabled={editing}
            activeOpacity={0.7}
          >
            {profile.profile_image_url ? (
              <Image source={{ uri: profile.profile_image_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <ProfileIcon />
              </View>
            )}
            <View style={styles.profileTextCol}>
              {editing ? (
                <TextInput
                  style={styles.nicknameInput}
                  value={nickname}
                  onChangeText={setNickname}
                  maxLength={50}
                  autoFocus
                />
              ) : (
                <Text style={styles.nickname}>{profile.nickname}</Text>
              )}
              <Text style={styles.providerLabel}>{PROVIDER_LABEL[profile.oauth_provider]}</Text>
            </View>
          </TouchableOpacity>

          {editing && (
            <TouchableOpacity style={styles.editButton} onPress={handleSave} disabled={saving}>
              <Text style={styles.editButtonText}>{saving ? '저장 중...' : '저장'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sectionTitle}>사용자 취향 그래프</Text>
        <View style={styles.radarCard}>
          {preferences === null ? (
            <ActivityIndicator style={styles.radarLoading} />
          ) : preferences.length === 0 ? (
            <Text style={styles.emptyText}>아직 취향 데이터가 없어요. 온보딩을 완료해보세요.</Text>
          ) : (
            <RadarChart data={preferences} />
          )}
        </View>

        <TouchableOpacity style={styles.retakeButton} onPress={confirmRetakeOnboarding}>
          <Text style={styles.retakeButtonText}>취향 재검사</Text>
        </TouchableOpacity>

        <View style={styles.menuList}>
          <TouchableOpacity style={styles.menuItem} onPress={() => setSubScreen('likes')}>
            <Text style={styles.menuItemText}>찜한 장소 보기</Text>
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity style={styles.menuItem} onPress={confirmWithdraw} disabled={withdrawing}>
            <Text style={[styles.menuItemText, styles.dangerText]}>
              {withdrawing ? '탈퇴 처리 중...' : '회원 탈퇴'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inquiryCard}>
          <Text style={styles.inquiryTitle}>문의</Text>
          {INQUIRY_ITEMS.map((label, index) => (
            <TouchableOpacity
              key={label}
              style={[styles.inquiryRow, index < INQUIRY_ITEMS.length - 1 && styles.inquiryRowDivider]}
              onPress={() => handleInquiryPress(label)}
            >
              <Text style={styles.inquiryRowText}>{label}</Text>
              <ChevronRightIcon />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <FloatingNav onHome={onExit} onShare={() => {}} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: { backgroundColor: colors.backgroundMuted, alignItems: 'center', justifyContent: 'center' },
  profileTextCol: { gap: 4 },
  nickname: { fontFamily: fonts.semiBold, fontSize: 18, letterSpacing: -0.5, color: colors.black },
  providerLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.gray500 },
  nicknameInput: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.black,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 2,
    minWidth: 100,
  },
  editButton: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: { fontFamily: fonts.medium, fontSize: 12, color: colors.gray700 },
  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    letterSpacing: -0.4,
    color: colors.black,
    marginTop: 28,
    marginBottom: 12,
  },
  radarCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  radarLoading: { paddingVertical: 40 },
  emptyText: { fontFamily: fonts.regular, fontSize: 13, color: colors.gray400, paddingVertical: 40 },
  retakeButton: {
    height: 52,
    borderRadius: 100,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  retakeButtonText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.white },
  menuList: { backgroundColor: colors.white, borderRadius: 16, marginTop: 28, overflow: 'hidden' },
  menuItem: { paddingVertical: 16, paddingHorizontal: 20 },
  menuItemText: { fontFamily: fonts.medium, fontSize: 15, letterSpacing: -0.4, color: colors.black },
  dangerText: { color: colors.danger },
  menuDivider: { height: 1, backgroundColor: colors.divider, marginHorizontal: 20 },
  // Figma "마이페이지"(598:13735) "문의" 박스 실측값 그대로 — 이 앱의 다른 카드(radarCard/
  // menuList)와 달리 radius8+테두리(e5e5ec) 스타일이라 그대로 반영(2026-09-06 추가)
  inquiryCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    marginTop: 28,
  },
  inquiryTitle: { fontFamily: fonts.semiBold, fontSize: 16, letterSpacing: -0.4, color: colors.black, marginBottom: 10 },
  inquiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
  },
  inquiryRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  inquiryRowText: { fontFamily: fonts.regular, fontSize: 14, letterSpacing: -0.35, color: colors.black },
});
