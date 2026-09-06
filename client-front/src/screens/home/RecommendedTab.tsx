import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { SimilarLogItem, exploreApi } from '../../api/explore';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/fonts';

// Figma 노드 334:2691("메인 페이지-맞춤 코스") — 실제로는 SSOT "유사 사용자 탐색"(취향 겹치는
// 다른 유저의 공개 방문 기록) 데이터. 디자인엔 작성자 아바타/닉네임/별점/사진 캐러셀이 있지만
// /explore/similar-logs 응답엔 그 정보가 없어서(장소·사진·한줄리뷰·태그만 있음) 그 부분은 생략함
// — 없는 데이터를 지어내지 않기 위한 선택 (2026-08-31 결정, decision-log 참고)
export function RecommendedTab() {
  const [logs, setLogs] = useState<SimilarLogItem[] | null>(null);

  useEffect(() => {
    exploreApi
      .similarLogs()
      .then((res) => setLogs(res.logs))
      .catch(() => setLogs([]));
  }, []);

  if (logs === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.black} />
      </View>
    );
  }

  return (
    <FlatList
      data={logs}
      keyExtractor={(item) => String(item.log_id)}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={<Text style={styles.title}>취향이 비슷한 사용자 코스 추천</Text>}
      ListEmptyComponent={<Text style={styles.emptyText}>아직 취향이 겹치는 유저의 공개 기록이 없어요</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          {item.photos[0] ? (
            <Image source={{ uri: item.photos[0].url }} style={styles.cardImage} resizeMode="cover" />
          ) : (
            <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
          )}
          <Text style={styles.cardPlaceName}>{item.place_name}</Text>
          {item.one_line ? <Text style={styles.cardOneLine}>{item.one_line}</Text> : null}
          {item.tags.length > 0 && (
            <View style={styles.tagRow}>
              {item.tags.map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagChipText}># {tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 20 },
  title: { fontFamily: fonts.semiBold, fontSize: 20, letterSpacing: -0.5, color: colors.black, marginBottom: 16 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.gray500, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 16 },
  cardImage: { width: '100%', height: 212, borderRadius: 16, marginBottom: 12 },
  cardImagePlaceholder: { backgroundColor: colors.border },
  cardPlaceName: { fontFamily: fonts.medium, fontSize: 16, letterSpacing: -0.4, color: colors.black, marginBottom: 4 },
  cardOneLine: { fontFamily: fonts.regular, fontSize: 14, color: colors.gray700, lineHeight: 20 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tagChip: { backgroundColor: colors.divider, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  tagChipText: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray700 },
});
