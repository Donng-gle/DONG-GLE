import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { PlaceCategory, PlaceListItem, placeApi } from '../api/place';
import { PlaceListItemRow } from '../components/PlaceListItemRow';
import { PlaceDetailScreen } from './PlaceDetailScreen';

interface Props {
  onExit: () => void;
  // 지정하면 장소를 눌렀을 때 상세화면 대신 이 콜백으로 선택 결과를 돌려줌 (코스 직접 만들기/수정 화면에서 재사용)
  onSelectPlace?: (place: PlaceListItem) => void;
}

const CATEGORIES: PlaceCategory[] = ['관광지', '식당', '카페', '액티비티', '문화공간', '축제행사'];

export function PlaceListScreen({ onExit, onSelectPlace }: Props) {
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
      <Text style={styles.title}>{onSelectPlace ? '장소 선택' : '장소 둘러보기'}</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="장소 이름 검색"
          onSubmitEditing={load}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={load}>
          <Text style={styles.searchButtonText}>검색</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CATEGORIES}
        keyExtractor={(item) => item}
        style={styles.categoryList}
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
        <ActivityIndicator size="large" style={styles.loading} />
      ) : (
        <FlatList
          data={places}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={<Text style={styles.emptyText}>결과가 없어요.</Text>}
          renderItem={({ item }) => (
            <PlaceListItemRow place={item} onPress={() => (onSelectPlace ? onSelectPlace(item) : setSelectedId(item.id))} />
          )}
        />
      )}

      <Button title="닫기" onPress={onExit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 32 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  searchButton: { justifyContent: 'center', paddingHorizontal: 16, backgroundColor: '#ff5a5f', borderRadius: 8 },
  searchButtonText: { color: '#fff', fontWeight: '700' },
  categoryList: { flexGrow: 0, marginBottom: 12 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
  },
  categoryChipSelected: { backgroundColor: '#222', borderColor: '#222' },
  categoryChipText: { fontSize: 13, color: '#222' },
  categoryChipTextSelected: { color: '#fff', fontWeight: '700' },
  loading: { marginTop: 40 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 40 },
});
