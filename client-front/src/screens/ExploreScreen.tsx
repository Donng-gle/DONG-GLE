import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View, ViewToken } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SimilarLogItem, exploreApi } from '../api/explore';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { PlaceDetailScreen } from './PlaceDetailScreen';

interface Props {
  onExit: () => void;
}

// Figma 노드 316:4122("유저 리스트")/507:10963("취향 비슷 사용자 프로필") 반영.
// 지도 SDK가 아직 없어서 뷰포트(bounds) 필터 없이 전체 목록으로 보여준다.
//
// 원본 디자인과 다르게 뺀 것:
// - 사진 여러 장 + 점 인디케이터 + 사진 우상단 좋아요 버튼: SimilarLogItem엔 사진이 photo_url 1장뿐이고
//   "방문 기록 좋아요" 개념 자체가 스키마에 없음(PLACE_LIKE만 존재) → 사진 1장만, 버튼 없이 표시
// - 카드에 있던 별점(예: ★★★★ 4.0): 같은 디자인 문서 안에서도 카드마다 있다 없다 해서(507:10963엔
//   없음, 316:4122의 두 번째 카드에만 있음) 확정된 요소로 보기 어렵고, 대응 데이터도 없어서 생략
export function ExploreScreen({ onExit }: Props) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<SimilarLogItem>>(null);
  const [logs, setLogs] = useState<SimilarLogItem[] | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    exploreApi
      .similarLogs()
      .then((response) => setLogs(response.logs))
      .catch((e) => {
        Alert.alert('탐색 결과를 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
        setLogs([]);
      });
  }, []);

  function scrollToIndex(index: number) {
    if (!logs || logs.length === 0) return;
    const clamped = Math.max(0, Math.min(index, logs.length - 1));
    listRef.current?.scrollToIndex({ index: clamped, animated: true });
    setCurrentIndex(clamped);
  }

  function handleViewableItemsChanged({ viewableItems }: { viewableItems: ViewToken[] }) {
    const first = viewableItems[0]?.index;
    if (first != null) setCurrentIndex(first);
  }

  if (selectedPlaceId != null) {
    return <PlaceDetailScreen placeId={selectedPlaceId} onExit={() => setSelectedPlaceId(null)} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onExit} hitSlop={8} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>비슷한 취향 탐색</Text>
        <View style={styles.backButton} />
      </View>
      <Text style={styles.subtitle}>내 상위 감성태그와 겹치는 다른 유저의 공개 방문 기록이에요.</Text>

      {logs === null ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.black} />
        </View>
      ) : (
        <>
          <FlatList
            ref={listRef}
            data={logs}
            keyExtractor={(item) => String(item.log_id)}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.cardGap} />}
            onViewableItemsChanged={handleViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
            onScrollToIndexFailed={() => {}}
            ListEmptyComponent={<Text style={styles.emptyText}>아직 취향이 겹치는 유저의 공개 기록이 없어요.</Text>}
            renderItem={({ item }) => <SimilarLogCard item={item} onSelectPlace={() => setSelectedPlaceId(item.place_id)} />}
          />

          {logs.length > 0 && (
            <View style={[styles.pager, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
              <PagerButton icon="⏮" onPress={() => scrollToIndex(0)} disabled={currentIndex === 0} />
              <PagerButton icon="◀" onPress={() => scrollToIndex(currentIndex - 1)} disabled={currentIndex === 0} />
              <Text style={styles.pagerText}>
                {currentIndex + 1} / {logs.length}
              </Text>
              <PagerButton icon="▶" onPress={() => scrollToIndex(currentIndex + 1)} disabled={currentIndex === logs.length - 1} />
              <PagerButton icon="⏭" onPress={() => scrollToIndex(logs.length - 1)} disabled={currentIndex === logs.length - 1} />
            </View>
          )}
        </>
      )}
    </View>
  );
}

function SimilarLogCard({ item, onSelectPlace }: { item: SimilarLogItem; onSelectPlace: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <View style={styles.profileRow}>
          {item.profile_image_url ? (
            <Image source={{ uri: item.profile_image_url }} style={styles.avatar} resizeMode="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]} />
          )}
          <View>
            <Text style={styles.nickname}>{item.nickname}</Text>
            {item.tags.length > 0 && (
              <Text style={styles.tagsText}>{item.tags.slice(0, 2).map((tag) => `# ${tag}`).join('  ')}</Text>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.selectButton} onPress={onSelectPlace}>
          <Text style={styles.selectButtonText}>선택</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.placeName}>{item.place_name}</Text>
      {item.one_line && (
        <Text style={styles.oneLine} numberOfLines={2}>
          {item.one_line}
        </Text>
      )}

      {item.photo_url ? (
        <Image source={{ uri: item.photo_url }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]} />
      )}
    </View>
  );
}

function PagerButton({ icon, onPress, disabled }: { icon: string; onPress: () => void; disabled: boolean }) {
  return (
    <TouchableOpacity style={styles.pagerButton} onPress={onPress} disabled={disabled} hitSlop={4}>
      <Text style={[styles.pagerButtonText, disabled && styles.pagerButtonTextDisabled]}>{icon}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 8 },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 20, color: colors.black },
  headerTitle: { flex: 1, fontFamily: fonts.semiBold, fontSize: 17, letterSpacing: -0.4, color: colors.black, textAlign: 'center' },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, color: colors.gray500, paddingHorizontal: 20, marginTop: 4, marginBottom: 8 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.gray400, textAlign: 'center', marginTop: 60 },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
  cardGap: { height: 12 },

  card: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 8 },
  avatarPlaceholder: { backgroundColor: colors.border },
  nickname: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.black },
  tagsText: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray500, marginTop: 4 },
  selectButton: { height: 32, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  selectButtonText: { fontFamily: fonts.medium, fontSize: 13, color: colors.black },

  placeName: { fontFamily: fonts.medium, fontSize: 16, letterSpacing: -0.4, color: colors.black, marginTop: 16 },
  oneLine: { fontFamily: fonts.regular, fontSize: 15, letterSpacing: -0.4, color: colors.gray700, marginTop: 6, lineHeight: 21 },
  photo: { width: '100%', aspectRatio: 292 / 212, borderRadius: 16, marginTop: 16 },
  photoPlaceholder: { backgroundColor: colors.border },

  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.divider },
  pagerButton: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  pagerButtonText: { fontSize: 12, color: colors.black },
  pagerButtonTextDisabled: { color: colors.border },
  pagerText: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.black, marginHorizontal: 8, minWidth: 56, textAlign: 'center' },
});
