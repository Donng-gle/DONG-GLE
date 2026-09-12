import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { UserProfile } from '../api/auth';
import { onboardingApi } from '../api/onboarding';
import { uploadApi } from '../api/upload';
import { UserPreferenceTag, userApi } from '../api/user';
import { tokenStorage } from '../auth/tokenStorage';
import { AppHeader } from '../components/AppHeader';
import { FloatingNav } from '../components/FloatingNav';
import { CameraIcon, ChevronRightIcon, ProfileIcon } from '../components/icons';
import { RadarChart } from '../components/RadarChart';
import { MOCK_ENABLED } from '../mocks/config';
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
  // FloatingNav 중앙 "일정 생성" 바텀시트용(2026-09-06 추가, decision-log 참고) — HomeScreen이
  // 실제 동작(코스 생성 화면 열기)을 쥐고 있어서 그대로 전달만 받음
  onCreateManual: () => void;
  onCreateAI: () => void;
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
export function ProfileScreen({
  profile,
  onProfileUpdated,
  onWithdrawn,
  onExit,
  onRetakeOnboarding,
  onCreateManual,
  onCreateAI,
}: Props) {
  const [nickname, setNickname] = useState(profile.nickname);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
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
      // 목업 모드에선 GET/PATCH /users/me 자체가 목업 처리가 안 돼 있어서(mocks/handlers.ts엔
      // /users/me/likes, /users/me/preferences 등 하위 경로만 있고 /users/me 자체는 없음) 이
      // 화면의 프로필(닉네임/프로바이더)이 실제로는 실기기에 저장된 진짜 로그인 토큰으로 실제
      // 배포 서버를 그대로 호출해서 보여주고 있었음 — 목업 모드에서 저장까지 눌러버리면 테스트용
      // 입력이 실제 계정에 반영돼버려서, 프로필 사진 업로드 기능을 추가하며 같이 발견하고 로컬
      // state만 갱신하도록 우회 처리 추가(2026-09-06, decision-log 참고)
      if (MOCK_ENABLED) {
        onProfileUpdated({ ...profile, nickname: nickname.trim() });
        setEditing(false);
        return;
      }
      const updated = await userApi.updateProfile({ nickname: nickname.trim() });
      onProfileUpdated(updated);
      setEditing(false);
    } catch (e) {
      Alert.alert('저장에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setSaving(false);
    }
  }

  // 아바타를 누르면 사진 선택 → 업로드까지 바로 이어짐(닉네임처럼 별도 "저장" 확인 단계 없음 —
  // 사진은 골라서 확정하면 바로 반영되는 게 자연스러운 흐름이라 판단, 2026-09-06 사용자 요청).
  // legacy:true — 방문기록 사진 선택과 동일하게 로컬 갤러리 접근 문제 방지(decision-log 참고)
  async function handlePickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('사진 접근 권한이 필요해요', '설정에서 사진 보관함 접근을 허용해주세요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, legacy: true });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      if (MOCK_ENABLED) {
        // handleSave와 동일한 이유로 로컬 uri만 반영하고 실제 업로드/PATCH는 건너뜀
        onProfileUpdated({ ...profile, profile_image_url: asset.uri });
        return;
      }
      const contentType = asset.mimeType ?? 'image/jpeg';
      const filename = asset.fileName ?? `profile-${Date.now()}.jpg`;
      const presigned = await uploadApi.getPresignedUrl({ filename, content_type: contentType, purpose: 'profile' });
      const file = await fetch(asset.uri).then((r) => r.blob());
      await uploadApi.uploadFile(presigned.upload_url, file, contentType);
      const updated = await userApi.updateProfile({ profile_image_url: presigned.file_url });
      onProfileUpdated(updated);
    } catch (e) {
      Alert.alert('프로필 사진 변경에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setUploadingAvatar(false);
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
      {
        text: '다시 검사',
        onPress: async () => {
          // onRetakeOnboarding은 has_onboarded를 로컬 state로만 false로 내려서 OnboardingScreen을
          // 다시 태우는데, 서버의 스와이프 기록/취향 벡터(user_preference)는 그대로 남아있어서
          // GET /onboarding/next가 여전히 "이미 수렴함"으로 보고 즉시 null을 돌려줬음(실기기 확인,
          // 2026-09-12) — 그 결과 재검사를 눌러도 카드 한 장 못 보고 "보여드릴 사진이 더 없어요"
          // 안내만 뜨고 바로 예전 벡터 그대로 완료 처리됨(재검사가 사실상 no-op이었음). 화면
          // 전환 전에 POST /onboarding/reset을 먼저 호출해서 서버 쪽 기록/벡터를 실제로 비움
          try {
            await onboardingApi.reset();
          } catch (e) {
            Alert.alert('초기화에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
            return;
          }
          onRetakeOnboarding();
        },
      },
    ]);
  }

  function handleInquiryPress(label: string) {
    Alert.alert(label, '아직 준비 중인 기능이에요.');
  }

  if (subScreen === 'likes') {
    return (
      <ScrapbookScreen
        initialTab="place"
        onExit={() => setSubScreen('none')}
        onCreateManual={onCreateManual}
        onCreateAI={onCreateAI}
        // 이미 마이페이지에서 한 단계 들어온 화면이라 "프로필로" = 그 마이페이지로 돌아가기
        onProfile={() => setSubScreen('none')}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <AppHeader onMenuPress={onExit} onSearchPress={onExit} onProfilePress={onExit} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileCard}>
          {/* 별도 "프로필 수정" 버튼 대신 프로필 영역을 누르면 바로 수정할 수 있게 변경
              (2026-09-06 사용자 요청) — 아바타/닉네임을 각자 다른 동작(사진 변경 vs 이름 수정)에
              연결해야 해서 하나의 TouchableOpacity 대신 둘로 분리(전엔 profileRow 전체가 하나의
              탭 영역이었음, 사진 변경 기능 추가하며 같이 정리) */}
          <View style={styles.profileRow}>
            <TouchableOpacity onPress={handlePickAvatar} disabled={uploadingAvatar} activeOpacity={0.8}>
              {profile.profile_image_url ? (
                <Image source={{ uri: profile.profile_image_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <ProfileIcon />
                </View>
              )}
              {uploadingAvatar ? (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color={colors.white} size="small" />
                </View>
              ) : (
                <View style={styles.avatarBadge}>
                  <CameraIcon />
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileTextCol}
              onPress={() => setEditing(true)}
              disabled={editing}
              activeOpacity={0.7}
            >
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
            </TouchableOpacity>
          </View>

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

      {/* 이미 마이페이지에 있으니 우측 "프로필" 버튼은 no-op(2026-09-06, decision-log 참고) */}
      <FloatingNav onHome={onExit} onCreateManual={onCreateManual} onCreateAI={onCreateAI} onProfile={() => {}} />
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
  // 아바타 우하단에 겹치는 "사진 변경" 배지(Figma엔 없음, 2026-09-06 신규 기능이라 앱 전반 톤인
  // 검정 배경+흰 아이콘으로 맞춤 — retakeButton/기본버튼 등과 동일 계열)
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.black,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(17,17,17,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  // Figma "마이페이지"(598:13735) "사용자 취향 그래프" 텍스트 실측: fontSize 20 / letterSpacing
  // -0.5(기존 16/-0.4는 실측 없이 넣은 값이라 시안보다 작아 보였음, 2026-09-12 정정)
  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    letterSpacing: -0.5,
    color: colors.black,
    marginTop: 28,
    marginBottom: 12,
  },
  // RadarChart 기본 size가 220→300으로 커져서(RadarChart.tsx 참고) minHeight도 같이 맞춤
  // (300 + paddingVertical 24*2 = 348, 여유 둬서 350)
  radarCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    // RadarChart 기본 size 330 + paddingVertical 24*2 = 378, 여유 둬서 380(2026-09-12, 300→330 상향에 맞춤)
    minHeight: 380,
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
