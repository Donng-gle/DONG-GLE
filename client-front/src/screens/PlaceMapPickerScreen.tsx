import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  PanResponder,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
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
// 시트가 열려있을 때 화면 높이의 이 비율만큼을 차지 — "지금 현재 켜져있는 위치"(2026-09-06
// 사용자 요청)가 곧 이 값. 드래그로 이보다 더 펼쳐지지는 않고, 접었다 다시 폈을 때도 이
// 위치까지만 돌아옴
const SHEET_OPEN_RATIO = 0.55;
// 접었을 때 화면에 남기는 손잡이+탭 줄만큼의 높이(리스트는 그 아래로 숨음)
const SHEET_PEEK_HEIGHT = 80;

// Figma 600:13996(기본)/600:14306(선택 상태) 반영. 2026-09-06 사용자가 두 차례 재지적하며
// 다듬음:
// 1차) "지도가 배경 전체를 차지하고 그 위에 검색창/리스트가 뜨는 진짜 오버레이" 구조로 변경,
//   다중 선택 지원(선택=즉시 코스에 더해지고 화면 유지, 이미 선택된 건 "취소"로 뺌, 선택된
//   장소는 전부 지도에 핀으로 남고 방금 누른 장소로만 카메라 이동)
// 2차) 이번 라운드: (a) 리스트 팝업을 손잡이로 드래그해서 접었다 펼 수 있게(단, 펼쳐도
//   SHEET_OPEN_RATIO까지만 — 화면을 다 덮진 않음), (b) 카메라 이동 시 핀이 팝업에 가려
//   안 보이던 문제 — 지도 전체의 정중앙이 아니라 팝업이 안 가리는 위쪽 영역의 중앙에
//   핀이 오도록 region 중심 좌표를 보정
export function PlaceMapPickerScreen({ onExit, selectedPlaces, onTogglePlace }: Props) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<PlaceListItem[] | null>(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // 시트 드래그 — 0(열림, SHEET_OPEN_RATIO 위치)~collapsedOffset(접힘, 손잡이만 보임) 사이를
  // 오감. sheetHeight는 onLayout으로 실측(화면 크기마다 % 높이의 실제 px가 다르므로)
  // sheetHeight는 PanResponder 콜백 안에서 읽어야 하는데, PanResponder.create(...)를
  // useRef(...).current로 한 번만 만들면 그 콜백들은 "만들어진 시점"의 state 값을 그대로
  // 캡처해버리는 stale closure가 됨(useState로 두면 onLayout이 나중에 갱신해도 콜백은
  // 여전히 최초값 0만 봄 — DONG-GLE PanResponder 관련 기존 교훈과 동일 패턴, 2026-09-06
  // 재발견). state 대신 ref로 미러링해서 콜백이 항상 최신값을 읽게 함
  const sheetHeightRef = useRef(0);
  const translateY = useRef(new Animated.Value(0)).current;
  const openOffset = useRef(0);
  const isOpen = useRef(true);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
      onPanResponderGrant: () => {
        translateY.stopAnimation();
      },
      onPanResponderMove: (_, gesture) => {
        // openOffset.current는 항상 "마지막으로 멈춘 절대 위치"(0 또는 collapsedOffset) —
        // 거기에 이번 제스처의 상대 이동량(gesture.dy)만 더해서 절대 좌표로 클램프
        const collapsedOffset = Math.max(sheetHeightRef.current - SHEET_PEEK_HEIGHT, 0);
        const next = openOffset.current + gesture.dy;
        translateY.setValue(Math.min(Math.max(next, 0), collapsedOffset));
      },
      onPanResponderRelease: (_, gesture) => {
        const collapsedOffset = Math.max(sheetHeightRef.current - SHEET_PEEK_HEIGHT, 0);
        const current = Math.min(Math.max(openOffset.current + gesture.dy, 0), collapsedOffset);
        const shouldCollapse = current > collapsedOffset / 2;
        const target = shouldCollapse ? collapsedOffset : 0;
        openOffset.current = target;
        isOpen.current = target === 0;
        Animated.spring(translateY, { toValue: target, useNativeDriver: true, bounciness: 2 }).start();
      },
    }),
  ).current;

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
  // delta 0.15)에 하회마을처럼 범위 밖인 장소가 많아서, 그냥 두면 핀이 화면 밖이라 안 보임.
  // 핀을 지도 정중앙이 아니라 팝업(하단 SHEET_OPEN_RATIO)이 안 가리는 위쪽 영역의 중앙에
  // 오도록 region 중심 위도를 보정(2026-09-06 사용자 지적) — region의 중심은 항상 뷰포트
  // 정중앙(50%)에 렌더링되니, 목표 지점이 "가려지지 않는 영역(위쪽 (1-비율)만큼)의 중앙"에
  // 오도록 하려면 중심을 목표보다 남쪽으로 당겨야 함
  function handleTap(place: PlaceListItem) {
    onTogglePlace(place);
    if (place.lat != null && place.lng != null) {
      const delta = 0.03;
      const visibleFraction = 1 - SHEET_OPEN_RATIO; // 팝업에 안 가리는 위쪽 비율
      const targetFractionFromTop = visibleFraction / 2; // 그 영역의 중앙
      const centerLat = place.lat + delta * (targetFractionFromTop - 0.5);
      mapRef.current?.animateToRegion(
        { latitude: centerLat, longitude: place.lng, latitudeDelta: delta, longitudeDelta: delta },
        400,
      );
      // 카메라 이동 결과를 바로 볼 수 있게 시트가 접혀있었으면 다시 열어줌
      if (!isOpen.current) {
        openOffset.current = 0;
        isOpen.current = true;
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 2 }).start();
      }
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

      <Animated.View
        style={[styles.sheet, { paddingBottom: Math.max(20, insets.bottom + 16), transform: [{ translateY }] }]}
        onLayout={(e) => {
          sheetHeightRef.current = e.nativeEvent.layout.height;
        }}
      >
        <View {...panResponder.panHandlers}>
          <View style={styles.handle} />

          <View style={styles.tabRow}>
            <TouchableOpacity style={[styles.tab, tab === 'all' && styles.tabSelected]} onPress={() => setTab('all')}>
              <Text style={[styles.tabText, tab === 'all' && styles.tabTextSelected]}>전체보기</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, tab === 'saved' && styles.tabSelected]} onPress={() => setTab('saved')}>
              <Text style={[styles.tabText, tab === 'saved' && styles.tabTextSelected]}>저장된 장소</Text>
            </TouchableOpacity>
            {/* 뒤로가기(←)를 누르면 그 날짜 장소 선택이 끝나는 흐름인데 잘 안 알려져 있어서, "전체보기/
                저장된 장소" 탭 줄 오른쪽 끝에 명시적인 "완료" 버튼을 둠(2026-09-08 사용자 요청 —
                처음엔 검색바 옆에 뒀다가 이 탭 줄 자리로 정정). 동작은 뒤로가기와 완전히 동일(onExit) */}
            <TouchableOpacity onPress={onExit} hitSlop={8} style={styles.doneButton}>
              <Text style={styles.doneButtonText}>완료</Text>
            </TouchableOpacity>
          </View>
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
      </Animated.View>
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
  // 리스트를 지도 위에 뜨는 팝업으로 취급 — 화면 하단에 SHEET_OPEN_RATIO 높이로 겹쳐 올리고,
  // 손잡이를 드래그하면 SHEET_PEEK_HEIGHT까지 접힘(2026-09-06 요청)
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: `${SHEET_OPEN_RATIO * 100}%`,
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
    alignItems: 'center',
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
  // 뒤로가기와 동작은 같지만(onExit) "이 날짜 장소 선택 완료" 흐름을 명시적으로 보여주는 버튼 —
  // marginLeft:'auto'로 탭 줄 오른쪽 끝에 붙임(2026-09-08 추가)
  doneButton: {
    marginLeft: 'auto',
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 100,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: { fontFamily: fonts.semiBold, fontSize: 12, letterSpacing: -0.3, color: colors.white },
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
