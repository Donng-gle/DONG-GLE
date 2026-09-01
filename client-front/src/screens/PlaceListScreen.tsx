import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
}

const CATEGORIES: PlaceCategory[] = ['관광지', '식당', '카페', '액티비티', '문화공간', '축제행사'];

// Figma 노드 362:3724("검색창") 색/형태 반영 — 자동완성 추천어 목록은 대응 데이터가 없어서
// (인기 검색어 API 없음) 제외, 기존 카테고리+검색 통합 화면 구조는 유지
export function PlaceListScreen({ onExit, onSelectPlace }: Props) {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<PlaceCategory | null>(null);
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<PlaceListItem[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  async function load() {
    setPlaces(null);
    const response = query.trim()
      ? await placeApi.search(query.trim())
      : await placeApi.list({ category: category ?? undefined });
    setPlaces(response.places);
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
            onSubmitEditing={load}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setQuery('');
                load();
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
  listContent: { paddingHorizontal: 20, paddingBottom: 24 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.gray500, textAlign: 'center', marginTop: 40 },
});
