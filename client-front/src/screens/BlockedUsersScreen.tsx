import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlockedUser, moderationApi } from '../api/moderation';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

interface Props {
  onExit: () => void;
}

// 마이페이지 "차단한 사용자 관리" — 앱스토어 심사 가이드라인 1.2 대응(2026-09-14 추가).
// ExploreScreen 헤더 패턴(뒤로가기+제목) 재사용
export function BlockedUsersScreen({ onExit }: Props) {
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<BlockedUser[] | null>(null);

  useEffect(() => {
    moderationApi
      .listBlockedUsers()
      .then((response) => setUsers(response.users))
      .catch((e) => {
        Alert.alert('차단 목록을 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
        setUsers([]);
      });
  }, []);

  function handleUnblock(user: BlockedUser) {
    Alert.alert('차단 해제', `${user.nickname}님의 차단을 해제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '해제',
        onPress: async () => {
          try {
            await moderationApi.unblockUser(user.user_id);
            setUsers((prev) => prev?.filter((u) => u.user_id !== user.user_id) ?? prev);
          } catch (e) {
            Alert.alert('차단 해제 실패', e instanceof Error ? e.message : '알 수 없는 오류');
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onExit} hitSlop={8} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>차단한 사용자 관리</Text>
        <View style={styles.backButton} />
      </View>

      {users === null ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.black} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => String(item.user_id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>차단한 사용자가 없어요.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              {item.profile_image_url ? (
                <Image source={{ uri: item.profile_image_url }} style={styles.avatar} resizeMode="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]} />
              )}
              <Text style={styles.nickname}>{item.nickname}</Text>
              <TouchableOpacity style={styles.unblockButton} onPress={() => handleUnblock(item)}>
                <Text style={styles.unblockButtonText}>차단 해제</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 8 },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 20, color: colors.black },
  headerTitle: { flex: 1, fontFamily: fonts.semiBold, fontSize: 17, letterSpacing: -0.4, color: colors.black, textAlign: 'center' },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.gray400, textAlign: 'center', marginTop: 60 },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: { width: 40, height: 40, borderRadius: 8 },
  avatarPlaceholder: { backgroundColor: colors.border },
  nickname: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.black },
  unblockButton: { height: 32, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  unblockButtonText: { fontFamily: fonts.medium, fontSize: 13, color: colors.black },
});
