import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlaceCategory, PlaceListItem, placeApi } from '../api/place';
import { PlaceListItemRow } from '../components/PlaceListItemRow';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { PlaceDetailScreen } from './PlaceDetailScreen';

interface Props {
  onExit: () => void;
  // 지정하면 장소를 눌렀을 때 상세화면 대신 이 콜백으로 선택 결과를 돌려줌 (코스 직접 만들기/수정 화면에서 재사용)
  onSelectPlace?: (place: PlaceListItem) => void;
  // 안동 거리 탭의 지도 위 카테고리 아이콘에서 넘어올 때 처음부터 그 카테고리로 필터링된 채로 열기
  // 위해 추가(2026-09-07) — 그 외엔 기존처럼 "전체"부터 시작
  initialCategory?: PlaceCategory;
}

const CATEGORIES: PlaceCategory[] = ['관광지', '식당', '카페', '액티비티', '문화공간', '축제행사'];
const PAGE_SIZE = 20;

// Figma 노드 362:3724("검색창") 색/형태 반영 — 인기 검색어/자동완성은 SearchScreen이 전담하고
// (2026-09-07 결정, decision-log 참고), 거기서 검색을 실행하면 목록이 아니라 바로 관광지 상세로
// 이동하도록 바뀌어서 이 화면은 더 이상 그 진입 경로로 쓰이지 않음 — 카테고리 탐색+자체 검색만 담당
export function PlaceListScreen({ onExit, onSelectPlace, initialCategory }: Props) {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<PlaceCategory | null>(initialCategory ?? null);
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<PlaceListItem[] | null>(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  // 관광지만 107건이라 기본 페이지(20건)로는 카테고리 하나도 다 못 보여줌 — 스크롤 끝에서
  // 다음 페이지를 이어붙이는 방식으로 전체를 다 볼 수 있게 함 (2026-09-04 수정, decision-log 참고)
  async function load(pageToLoad: number) {
    if (pageToLoad === 1) {
      setPlaces(null);
    } else {
      setLoadingMore(true);
    }
    try {
      const response = query.trim()
        ? await placeApi.search(query.trim(), pageToLoad, PAGE_SIZE)
        : await placeApi.list({ category: category ?? undefined, page: pageToLoad, size: PAGE_SIZE });
      setPlaces((prev) => (pageToLoad === 1 ? response.places : [...(prev ?? []), ...response.places]));
      setPage(pageToLoad);
      setHasNext(response.meta.has_next);
    } catch (e) {
      Alert.alert('장소를 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
      if (pageToLoad === 1) setPlaces([]);
    } finally {
      setLoadingMore(false);
    }
  }

  function loadMore() {
    if (!loadingMore && hasNext) load(page + 1);
  }

  if (!onSelectPlace && selectedId != null) {
    return <PlaceDetailScreen placeId={selectedId} onExit={() => setSelectedId(null)} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onExit} hitSlop={8} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={onSelectPlace ? '장소 검색' : '안동'}
            placeholderTextColor={colors.gray500}
            onSubmitEditing={() => load(1)}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setQuery('');
                load(1);
              }}
              hitSlop={8}
            >
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CATEGORIES}
        keyExtractor={(item) => item}
        style={styles.categoryList}
        contentContainerStyle={styles.categoryListContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.categoryChip, category === item && styles.categoryChipSelected]}
            onPress={() => {
              setQuery('');
              setCategory(category === item ? null : item);
            }}
          >
            <Text style={[styles.categoryChipText, category === item && styles.categoryChipTextSelected]}>{item}</Text>
          </TouchableOpacity>
        )}
      />

      {places === null ? (
        <ActivityIndicator size="large" color={colors.black} style={styles.loading} />
      ) : (
        <FlatList
          data={places}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>결과가 없어요</Text>}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.black} style={styles.footerLoading} /> : null}
          renderItem={({ item }) => (
            <PlaceListItemRow place={item} onPress={() => (onSelectPlace ? onSelectPlace(item) : setSelectedId(item.id))} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  backButton: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 18, color: colors.black },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundMuted,
    paddingHorizontal: 14,
    gap: 8,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.black, padding: 0 },
  clearIcon: { fontSize: 14, color: colors.gray500 },
  categoryList: { flexGrow: 0 },
  categoryListContent: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  categoryChipSelected: { backgroundColor: colors.black, borderColor: colors.black },
  categoryChipText: { fontFamily: fonts.medium, fontSize: 13, letterSpacing: -0.3, color: colors.gray700 },
  categoryChipTextSelected: { color: colors.white },
  loading: { marginTop: 40 },
  footerLoading: { marginVertical: 16 },
  listContent: { paddingHorizontal: 20, paddingBottom: 24 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.gray500, textAlign: 'center', marginTop: 40 },
});
