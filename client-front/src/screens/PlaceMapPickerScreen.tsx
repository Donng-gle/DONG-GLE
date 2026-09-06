import { useEffect, useState } from 'react';
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
  onSelectPlace: (place: PlaceListItem) => void;
}

type Tab = 'all' | 'saved';

const ANDONG_REGION = { latitude: 36.5684, longitude: 128.7294, latitudeDelta: 0.15, longitudeDelta: 0.15 };
const PAGE_SIZE = 20;

// Figma 600:13996(기본)/600:14306(장소 미리보기 상태) 반영(2026-09-06, 사용자가 스크린샷
// 재검토 요청) — "직접 일정 만들기 → 장소 추가"에서만 쓰는 지도 연동 검색 화면. 기존
// PlaceListScreen(카테고리 칩 목록, 지도 없음)은 다른 곳에서 계속 그대로 쓰고 이 화면만 새로 만듦.
//
// 실측과 실제 데이터가 안 맞는 부분은 이렇게 근사함:
// - 시안엔 지도 위에 뜨는 흰 바텀시트가 드래그로 확장되는데, 이 프로젝트엔 바텀시트 라이브러리가
//   없어서 지도(고정 높이)+흰 콘텐츠 영역(고정)을 위아래로 쌓는 정적 레이아웃으로 단순화
// - 탭이 "전체보기"/"저장된 장소"/"저장된 장소"(똑같은 라벨 2번, 시안 자체의 복붙 실수로 보임)
//   3개인데 의미상 다른 탭 2개("전체보기"/"저장된 장소")만 구현
// - 장소 카드 두 번째 줄 설명 문구는 시안에 모든 카드가 똑같은 더미 텍스트라 실제 데이터엔 없는
//   필드(place list API에 없음) — 대신 기존 목록 화면과 같은 카테고리·주소 조합으로 대체
// - 지도 핀은 시안이 커스텀 SVG(파란 눈물방울+흰 점)인데 react-native-maps 기본 마커를
//   파란색으로 칠해서 근사(모양 자체는 거의 동일)
//
// 인터랙션: 카드를 탭하면 그 장소가 지도에 파란 핀으로 뜨고 이름이 파란색으로 강조되는
// "미리보기" 상태가 됨(600:14306) — 실제 코스에 추가되는 건 "선택" 버튼을 눌렀을 때(onSelectPlace)
export function PlaceMapPickerScreen({ onExit, onSelectPlace }: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<PlaceListItem[] | null>(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [previewId, setPreviewId] = useState<number | null>(null);

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function load(pageToLoad: number) {
    if (pageToLoad === 1) {
      setPlaces(null);
      setPreviewId(null);
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

  const previewPlace = places?.find((p) => p.id === previewId) ?? null;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

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

      <MapView provider={PROVIDER_GOOGLE} style={styles.map} initialRegion={ANDONG_REGION}>
        {previewPlace?.lat != null && previewPlace?.lng != null && (
          <Marker
            coordinate={{ latitude: previewPlace.lat, longitude: previewPlace.lng }}
            pinColor={colors.accentBlue}
          />
        )}
      </MapView>

      <View style={styles.sheet}>
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
            contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(20, insets.bottom + 16) }]}
            ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
            ListEmptyComponent={<Text style={styles.emptyText}>결과가 없어요</Text>}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.black} style={styles.footerLoading} /> : null}
            renderItem={({ item }) => {
              const isPreviewed = item.id === previewId;
              return (
                <TouchableOpacity style={styles.row} onPress={() => setPreviewId(item.id)}>
                  {item.main_image_url ? (
                    <Image source={{ uri: item.main_image_url }} style={styles.thumbnail} resizeMode="cover" />
                  ) : (
                    <View style={[styles.thumbnail, styles.thumbnailPlaceholder]} />
                  )}
                  <View style={styles.rowInfo}>
                    <Text style={[styles.rowName, isPreviewed && styles.rowNameSelected]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={2}>
                      {item.category}
                      {item.addr1 ? ` · ${item.addr1}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.selectButton} onPress={() => onSelectPlace(item)}>
                    <Text style={styles.selectButtonText}>선택</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    marginHorizontal: 20,
    paddingHorizontal: 16,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    gap: 10,
    zIndex: 1,
  },
  backIcon: { fontSize: 18, color: colors.black },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 16, letterSpacing: -0.4, color: colors.black, padding: 0 },
  searchIcon: { fontSize: 16 },
  map: { width: '100%', height: 260, marginTop: -20 },
  sheet: { flex: 1, backgroundColor: colors.white },
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
  listContent: { paddingHorizontal: 20, paddingTop: 12 },
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
  selectButtonText: { fontFamily: fonts.semiBold, fontSize: 12, letterSpacing: -0.3, color: colors.gray500 },
});
