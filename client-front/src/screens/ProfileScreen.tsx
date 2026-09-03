import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { UserProfile } from '../api/auth';
import { UserPreferenceTag, userApi } from '../api/user';
import { tokenStorage } from '../auth/tokenStorage';
import { ScrapbookScreen } from './ScrapbookScreen';

interface Props {
  profile: UserProfile;
  onProfileUpdated: (profile: UserProfile) => void;
  onWithdrawn: () => void;
  onExit: () => void;
}

type SubScreen = 'none' | 'likes';

export function ProfileScreen({ profile, onProfileUpdated, onWithdrawn, onExit }: Props) {
  const [nickname, setNickname] = useState(profile.nickname);
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
      Alert.alert('저장했어요');
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

  if (subScreen === 'likes') {
    return <ScrapbookScreen initialTab="place" onExit={() => setSubScreen('none')} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>내 정보</Text>

      <Text style={styles.label}>이메일</Text>
      <Text style={styles.readonlyValue}>({profile.oauth_provider} 계정, 수정 불가)</Text>

      <Text style={styles.label}>닉네임</Text>
      <TextInput style={styles.input} value={nickname} onChangeText={setNickname} maxLength={50} />
      <Button title={saving ? '저장 중...' : '닉네임 저장'} onPress={handleSave} disabled={saving} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>내 취향 프로필</Text>
        {preferences === null ? (
          <ActivityIndicator />
        ) : preferences.length === 0 ? (
          <Text style={styles.emptyText}>아직 취향 데이터가 없어요. 온보딩을 완료해보세요.</Text>
        ) : (
          preferences
            .sort((a, b) => b.score - a.score)
            .map((pref) => (
              <Text key={pref.tag} style={styles.prefRow}>
                {pref.tag} — {pref.score.toFixed(2)}
              </Text>
            ))
        )}
      </View>

      <View style={styles.section}>
        <Button title="찜한 장소 보기" onPress={() => setSubScreen('likes')} />
      </View>

      <View style={styles.section}>
        <Button title="닫기" onPress={onExit} />
        <View style={styles.gap} />
        <Button
          title={withdrawing ? '탈퇴 처리 중...' : '회원 탈퇴'}
          color="#d33"
          onPress={confirmWithdraw}
          disabled={withdrawing}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 32 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  label: { fontSize: 13, color: '#666', marginTop: 16, marginBottom: 6 },
  readonlyValue: { fontSize: 14, color: '#999' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
  },
  section: { marginTop: 28 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  prefRow: { fontSize: 14, color: '#333', marginBottom: 4 },
  emptyText: { fontSize: 13, color: '#999' },
  gap: { height: 12 },
});
