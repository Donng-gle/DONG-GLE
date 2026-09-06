import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlaceListItem, placeApi } from '../api/place';
import { userApi } from '../api/user';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

interface Props {
  onExit: () => void;
  // 이미 이 날짜에 담겨있는 장소들(핀으로 계속 떠있어야 함) + 토글 콜백(있으면 빼고, 없으면 더함)
  selectedPlaces: PlaceListItem[];
  onTogglePlace: (place: PlaceListItem) => void;
}

type Tab = 'all' | 'saved';

const ANDONG_REGION = { latitude: 36.5684, longitude: 128.7294, latitudeDelta: 0.15, longitudeDelta: 0.15 };
const PAGE_SIZE = 20;

// Figma 600:13996(기본)/600:14306(선택 상태) 반영. 2026-09-06 사용자 재지적으로 두 가지 크게
// 고침(처음엔 "비슷하게"로 잘못 단순화했었음):
// 1) "지도가 배경 전체를 차지하고 그 위에 검색창/리스트가 뜨는 진짜 오버레이" 구조로 변경 —
//    지도를 화면 전체에 깔고(StyleSheet.absoluteFill), 검색창은 지도 위 플로팅, 장소 리스트는
//    화면 하단에 뜨는 팝업(고정 높이 카드, 둥근 위 모서리)으로 지도 위에 겹치게 함
//    (드래그로 늘어나는 진짜 바텀시트는 이 프로젝트에 라이브러리가 없어서 고정 높이로 근사)
// 2) 다중 선택 지원 — "선택"을 누르면 그 장소가 즉시 코스에 더해지고 화면은 안 닫힘(계속
//    골라 담을 수 있음), 이미 선택된 걸 다시 누르면 "취소"(제거)됨. 선택된 장소는 전부
//    지도에 핀으로 남아있고, 방금 누른 장소로만 카메라가 이동함(다른 핀은 그대로 유지)
export function PlaceMapPickerScreen({ onExit, selectedPlaces, onTogglePlace }: Props) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<PlaceListItem[] | null>(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function load(pageToLoad: number) {
    if (pageToLoad === 1) {
      setPlaces(null);
    } else {
      setLoadingMore(true);
    }
    try {
      const response =
        tab === 'saved'
          ? await userApi.getLikes(pageToLoad, PAGE_SIZE)
          : query.trim()
            ? await placeApi.search(query.trim(), pageToLoad, PAGE_SIZE)
            : await placeApi.list({ page: pageToLoad, size: PAGE_SIZE });
      setPlaces((prev) => (pageToLoad === 1 ? response.places : [...(prev ?? []), ...response.places]));
      setPage(pageToLoad);
      setHasNext(response.meta.has_next);
    } catch {
      if (pageToLoad === 1) setPlaces([]);
    } finally {
      setLoadingMore(false);
    }
  }

  function loadMore() {
    if (!loadingMore && hasNext) load(page + 1);
  }

  // 토글(선택/취소) 둘 다 "방금 누른 장소"로 카메라를 옮김 — 안동 시내 기준 지도(초기
  // delta 0.15)에 하회마을처럼 범위 밖인 장소가 많아서, 그냥 두면 핀이 화면 밖이라 안 보임
  function handleTap(place: PlaceListItem) {
    onTogglePlace(place);
    if (place.lat != null && place.lng != null) {
      mapRef.current?.animateToRegion(
        { latitude: place.lat, longitude: place.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 },
        400,
      );
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <MapView ref={mapRef} provider={PROVIDER_GOOGLE} style={StyleSheet.absoluteFill} initialRegion={ANDONG_REGION}>
        {selectedPlaces
          .filter((p) => p.lat != null && p.lng != null)
          .map((p) => (
            <Marker key={p.id} coordinate={{ latitude: p.lat as number, longitude: p.lng as number }} pinColor={colors.accentBlue} />
          ))}
      </MapView>

      <View style={[styles.searchBar, { marginTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onExit} hitSlop={8}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="안동의 명소 검색"
          placeholderTextColor={colors.gray500}
          onSubmitEditing={() => load(1)}
          returnKeyType="search"
        />
        <TouchableOpacity onPress={() => load(1)} hitSlop={8}>
          <Text style={styles.searchIcon}>🔍</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.sheet, { paddingBottom: Math.max(20, insets.bottom + 16) }]}>
        <View style={styles.handle} />

        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tab, tab === 'all' && styles.tabSelected]} onPress={() => setTab('all')}>
            <Text style={[styles.tabText, tab === 'all' && styles.tabTextSelected]}>전체보기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'saved' && styles.tabSelected]} onPress={() => setTab('saved')}>
            <Text style={[styles.tabText, tab === 'saved' && styles.tabTextSelected]}>저장된 장소</Text>
          </TouchableOpacity>
        </View>

        {places === null ? (
          <ActivityIndicator size="large" color={colors.black} style={styles.loading} />
        ) : (
          <FlatList
            data={places}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
            ListEmptyComponent={<Text style={styles.emptyText}>결과가 없어요</Text>}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.black} style={styles.footerLoading} /> : null}
            renderItem={({ item }) => {
              const isSelected = selectedPlaces.some((p) => p.id === item.id);
              return (
                <TouchableOpacity style={styles.row} onPress={() => handleTap(item)}>
                  {item.main_image_url ? (
                    <Image source={{ uri: item.main_image_url }} style={styles.thumbnail} resizeMode="cover" />
                  ) : (
                    <View style={[styles.thumbnail, styles.thumbnailPlaceholder]} />
                  )}
                  <View style={styles.rowInfo}>
                    <Text style={[styles.rowName, isSelected && styles.rowNameSelected]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={2}>
                      {item.category}
                      {item.addr1 ? ` · ${item.addr1}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity style={[styles.selectButton, isSelected && styles.selectButtonSelected]} onPress={() => handleTap(item)}>
                    <Text style={[styles.selectButtonText, isSelected && styles.selectButtonTextSelected]}>
                      {isSelected ? '취소' : '선택'}
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  searchBar: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    gap: 10,
    // 지도 위에 뜨는 카드라 그림자로 띄워 보이게(2026-09-06, "지도가 배경 전체" 요청 반영)
    shadowColor: colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  backIcon: { fontSize: 18, color: colors.black },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 16, letterSpacing: -0.4, color: colors.black, padding: 0 },
  searchIcon: { fontSize: 16 },
  // 리스트를 지도 위에 뜨는 팝업으로 취급(2026-09-06 요청) — 화면 하단에 고정 높이로 겹쳐 올림.
  // 드래그로 늘어나는 진짜 바텀시트 라이브러리가 없어서 고정 55% 높이로 근사
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: colors.black,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  handle: { alignSelf: 'center', width: 54, height: 5, borderRadius: 100, backgroundColor: colors.gray700, marginTop: 10 },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.tabDivider,
  },
  tab: { paddingHorizontal: 16, height: 40, borderRadius: 100, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.chipBorderMuted },
  tabSelected: { backgroundColor: 'rgba(0,102,255,0.1)', borderColor: colors.accentBlue },
  tabText: { fontFamily: fonts.medium, fontSize: 12, color: colors.gray700 },
  tabTextSelected: { color: colors.accentBlue },
  loading: { marginTop: 40 },
  footerLoading: { marginVertical: 16 },
  listContent: { paddingHorizontal: 20, paddingTop: 12, flexGrow: 1 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.gray500, textAlign: 'center', marginTop: 40 },
  rowDivider: { height: 1, backgroundColor: colors.rowDivider },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  thumbnail: { width: 66, height: 66, borderRadius: 4 },
  thumbnailPlaceholder: { backgroundColor: colors.border },
  rowInfo: { flex: 1 },
  rowName: { fontFamily: fonts.medium, fontSize: 16, letterSpacing: -0.4, color: colors.black },
  rowNameSelected: { fontFamily: fonts.semiBold, color: colors.accentBlue },
  rowMeta: { fontFamily: fonts.regular, fontSize: 12, letterSpacing: -0.3, color: colors.gray500, marginTop: 4 },
  selectButton: { height: 33, paddingHorizontal: 14, borderRadius: 100, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  selectButtonSelected: { backgroundColor: colors.accentBlue },
  selectButtonText: { fontFamily: fonts.semiBold, fontSize: 12, letterSpacing: -0.3, color: colors.gray500 },
  selectButtonTextSelected: { color: colors.white },
});
