import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { PlaceCategory, PlaceListItem, placeApi } from '../../api/place';
import { AndongGlobe } from '../../components/AndongGlobe';
import { LocationPinIcon } from '../../components/icons';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/fonts';
import { PlaceDetailScreen } from '../PlaceDetailScreen';

const GLOBE_SIZE = Dimensions.get('window').width;
const PAGE_SIZE = 20;

// 바텀시트 상수 — JournalTab.tsx("나의 일지" 탭)와 완전히 동일한 값 그대로 재사용. 사용자가
// "나의 일지 정도 위치에 생긴다"고 명시적으로 그 탭 시트 위치를 기준으로 요청했고, PanResponder+
// Animated 기반 접힘/펼침 메커니즘 자체도 거기서 이미 실기기로 검증된 걸 그대로 가져옴
// (2026-09-07, decision-log 참고)
const PEEK_HEIGHT = 76;
const NAV_CLEARANCE = 72;
const SNAP_THRESHOLD_RATIO = 0.35;

// 선택된 카테고리 아이콘은 커지고 나머지는 작아짐 — 위치 기준점은 아이콘 "아래쪽 중앙"(점 마커가
// 찍힌 자리)으로 고정해서, 커지고 작아져도 지도 위 실제 위치가 위아래로 밀리지 않게 함
const SELECTED_SCALE = 1.35;
const UNSELECTED_SCALE = 0.7;
// 나머지 아이콘 흐리게(사용자 요청, 2026-09-07 추가)
const UNSELECTED_OPACITY = 0.35;

// Figma 노드 334:3255("메인 페이지-안동 거리") 실측 — 구글맵+칩+리스트였던 걸 전면 교체.
// 실제론 인터랙티브 지도가 아니라 안동시 일러스트(360x360) 위에 카테고리별 3D 아이콘 6개를 정해진
// 위치에 얹어둔 디자인이라, 나의 일지 탭에서 쓰던 AndongGlobe(사용자 명시 요청 — "기존 메인
// 화면에 있던 지도")를 그대로 재사용하고 그 위에 이 6개 아이콘을 오버레이함.
//
// 아이콘 6개는 Figma에 실제 이미지로 박혀있는 걸(라벨+점 마커까지 이미지 안에 다 포함) 사용자가
// PNG로 내보내서 줌 — assets/images/street-categories/*.png (3x, 150x225).
//
// AndongGlobe는 원래 드래그로 회전 가능한데(나의 일지 탭), 그 상태로 아이콘을 얹으면 회전할수록
// 아이콘 위치와 실제 지도 텍스처가 어긋나므로 이 화면에서만 interactive=false로 회전을 꺼서
// 아이콘이 항상 제자리에 고정되게 함(AndongGlobe.tsx에 prop 추가)
//
// 2026-09-07 추가: 처음엔 카테고리 아이콘을 누르면 바로 PlaceListScreen으로 이동했는데, 사용자가
// "선택한 카테고리 아이콘만 커지고 나머지는 작아지며, 하단에 나의 일지 정도 위치의 팝업(바텀시트)이
// 뜨고, 그걸 끝까지 올리면 화면 전체를 채우는 목록이 된다"고 정정 — JournalTab의 바텀시트 메커니즘을
// 그대로 가져와서 재구현. Figma 재연결이 끊긴 상태라 카드 레이아웃(사진+카테고리 배지+하트,
// 이름+주소)은 세션 앞부분에 이미 실측해둔 334:3255 "장소 카드" 노드 값을 그대로 씀 — 다만 그
// 카드엔 별점(★4.0)이 있는데 목록 API(PlaceListItem)엔 rating 필드 자체가 없어서(PlaceDetail에만
// 있음, decision-log 참고) 계속 생략함. 펼친 상태 화면도 이 Figma 프레임을 그대로 참고
const CATEGORY_MARKERS: {
  category: PlaceCategory;
  icon: number;
  // Figma 실측(334:3255 하위 6개 Frame) — 360x360 지도 기준 좌상단 좌표+크기, 비율로 환산해서
  // GLOBE_SIZE(기기 폭)에 맞춰 스케일
  left: number;
  top: number;
  width: number;
  height: number;
}[] = [
  {
    category: '관광지',
    icon: require('../../../assets/images/street-categories/tourist-spot.png'),
    left: 161 / 360,
    top: 35 / 360,
    width: 50 / 360,
    height: 75 / 360,
  },
  {
    category: '카페',
    icon: require('../../../assets/images/street-categories/cafe.png'),
    left: 247 / 360,
    top: 88 / 360,
    width: 50 / 360,
    height: 75 / 360,
  },
  {
    category: '액티비티',
    icon: require('../../../assets/images/street-categories/activity.png'),
    left: 170 / 360,
    top: 138 / 360,
    width: 50 / 360,
    height: 75 / 360,
  },
  {
    category: '축제행사',
    icon: require('../../../assets/images/street-categories/festival.png'),
    left: 67 / 360,
    top: 96 / 360,
    width: 50 / 360,
    height: 75 / 360,
  },
  {
    category: '문화공간',
    icon: require('../../../assets/images/street-categories/culture.png'),
    left: 92 / 360,
    top: 188 / 360,
    width: 50 / 360,
    height: 75 / 360,
  },
  {
    category: '식당',
    icon: require('../../../assets/images/street-categories/restaurant.png'),
    left: 238 / 360,
    top: 226 / 360,
    width: 50 / 360,
    height: 75 / 360,
  },
];

export function StreetTab() {
  const insets = useSafeAreaInsets();
  const [selectedCategory, setSelectedCategory] = useState<PlaceCategory | null>(null);
  const [places, setPlaces] = useState<PlaceListItem[] | null>(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<number | null>(null);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  // JournalTab과 동일한 드래그 시트 메커니즘 — 주석은 거기 참고
  const translateY = useRef(new Animated.Value(0)).current;
  const translateYRef = useRef(0);
  const dragBaseValue = useRef(0);
  const maxTranslate = useRef(0);
  const listRef = useRef<FlatList<PlaceListItem>>(null);

  function handleContainerLayout(height: number) {
    if (containerHeight != null) return;
    setContainerHeight(height);
    const panelHeight = Math.max(0, height - insets.bottom);
    maxTranslate.current = Math.max(0, panelHeight - PEEK_HEIGHT - NAV_CLEARANCE);
    translateY.setValue(maxTranslate.current);
    translateYRef.current = maxTranslate.current;
  }

  function loadPlaces(category: PlaceCategory, pageToLoad: number) {
    if (pageToLoad === 1) {
      setPlaces(null);
    } else {
      setLoadingMore(true);
    }
    placeApi
      .list({ category, page: pageToLoad, size: PAGE_SIZE })
      .then((res) => {
        setPlaces((prev) => (pageToLoad === 1 ? res.places : [...(prev ?? []), ...res.places]));
        setPage(pageToLoad);
        setHasNext(res.meta.has_next);
      })
      .catch((e) => {
        Alert.alert('장소를 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
        if (pageToLoad === 1) setPlaces([]);
      })
      .finally(() => setLoadingMore(false));
  }

  function loadMorePlaces() {
    if (selectedCategory && !loadingMore && hasNext) loadPlaces(selectedCategory, page + 1);
  }

  // 마커를 누르면: 같은 카테고리를 다시 누르면 닫고(토글), 다른 카테고리면 그걸로 바꿔서 목록을
  // 새로 불러오고 시트를 접힘(peek) 상태로 되돌림
  function selectCategory(category: PlaceCategory) {
    if (selectedCategory === category) {
      setSelectedCategory(null);
      setExpanded(false);
      return;
    }
    setSelectedCategory(category);
    setExpanded(false);
    if (maxTranslate.current > 0) {
      translateY.setValue(maxTranslate.current);
      translateYRef.current = maxTranslate.current;
    }
    loadPlaces(category, 1);
  }

  function snapTo(next: boolean) {
    setExpanded(next);
    if (!next) listRef.current?.scrollToOffset({ offset: 0, animated: false });
    const target = next ? 0 : maxTranslate.current;
    translateYRef.current = target;
    Animated.spring(translateY, { toValue: target, useNativeDriver: true, bounciness: 4 }).start();
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 2,
      onPanResponderGrant: () => {
        dragBaseValue.current = translateYRef.current;
      },
      onPanResponderMove: (_, gesture) => {
        const next = clamp(dragBaseValue.current + gesture.dy, 0, maxTranslate.current);
        translateY.setValue(next);
        translateYRef.current = next;
      },
      onPanResponderRelease: (_, gesture) => {
        const current = clamp(dragBaseValue.current + gesture.dy, 0, maxTranslate.current);
        snapTo(current < maxTranslate.current * SNAP_THRESHOLD_RATIO);
      },
    }),
  ).current;

  async function toggleLike(place: PlaceListItem) {
    if (place.is_liked === null) {
      Alert.alert('로그인이 필요해요', '찜하려면 먼저 로그인해주세요.');
      return;
    }
    try {
      const result = place.is_liked ? await placeApi.unlike(place.id) : await placeApi.like(place.id);
      setPlaces((prev) => (prev ?? []).map((p) => (p.id === place.id ? { ...p, is_liked: result.is_liked } : p)));
    } catch (e) {
      Alert.alert('찜 처리에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    }
  }

  if (selectedPlaceId != null) {
    return <PlaceDetailScreen placeId={selectedPlaceId} onExit={() => setSelectedPlaceId(null)} />;
  }

  const panelHeight = containerHeight != null ? Math.max(0, containerHeight - insets.bottom) : 0;

  return (
    <View style={styles.container} onLayout={(e) => handleContainerLayout(e.nativeEvent.layout.height)}>
      <View style={styles.globeWrap}>
        <AndongGlobe size={GLOBE_SIZE} interactive={false} />
        <View style={[styles.markerLayer, { width: GLOBE_SIZE, height: GLOBE_SIZE }]} pointerEvents="box-none">
          {CATEGORY_MARKERS.map((m) => {
            const isSelected = selectedCategory === m.category;
            const scale = selectedCategory == null ? 1 : isSelected ? SELECTED_SCALE : UNSELECTED_SCALE;
            // 선택된 게 있으면 나머지는 흐리게(사용자 요청, 2026-09-07 추가) — 선택 없을 땐 전부 선명
            const opacity = selectedCategory == null || isSelected ? 1 : UNSELECTED_OPACITY;
            const baseW = m.width * GLOBE_SIZE;
            const baseH = m.height * GLOBE_SIZE;
            const w = baseW * scale;
            const h = baseH * scale;
            // 기준점(아이콘 아래쪽 중앙, 점 마커 위치)을 고정하고 거기서부터 커지거나 작아지게
            const anchorX = m.left * GLOBE_SIZE + baseW / 2;
            const anchorY = m.top * GLOBE_SIZE + baseH;
            return (
              <TouchableOpacity
                key={m.category}
                style={[styles.marker, { left: anchorX - w / 2, top: anchorY - h, width: w, height: h, opacity }]}
                onPress={() => selectCategory(m.category)}
              >
                <Image source={m.icon} style={styles.markerImage} resizeMode="contain" />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {selectedCategory != null && containerHeight != null && (
        // pointerEvents="box-none" — 이 View 자체(와 시트가 접혀서 안 보이는 빈 위쪽 여백)는 터치를
        // 안 먹고 실제 자식(핸들/리스트)만 터치되게 함. 이게 없으면 시트가 peek 상태로 접혀 있어도
        // 화면 전체 높이만큼 잡고 있는 빈 영역이 지도 위 다른 카테고리 아이콘 탭을 가로채서 카테고리를
        // 못 바꾸는 버그가 있었음(2026-09-07 사용자 리포트로 발견/수정)
        <View style={[styles.sheetClip, { height: panelHeight }]} pointerEvents="box-none">
          <Animated.View
            style={[styles.sheet, { height: panelHeight, transform: [{ translateY }] }]}
            pointerEvents="box-none"
          >
            <View style={styles.handleArea} {...panResponder.panHandlers}>
              <View style={styles.handleBar} />
              <Text style={styles.sheetTitle}>{selectedCategory} 관련 명소</Text>
            </View>
            <FlatList
              ref={listRef}
              data={places ?? []}
              keyExtractor={(item) => String(item.id)}
              scrollEnabled={expanded}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              onEndReached={loadMorePlaces}
              onEndReachedThreshold={0.5}
              ListEmptyComponent={
                places != null ? <Text style={styles.emptyText}>해당 카테고리에 장소가 없어요</Text> : null
              }
              ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.black} style={styles.footerLoading} /> : null}
              renderItem={({ item }) => (
                <PlaceCategoryCard place={item} onPress={() => setSelectedPlaceId(item.id)} onToggleLike={() => toggleLike(item)} />
              )}
            />
          </Animated.View>
        </View>
      )}
    </View>
  );
}

// Figma 재실측(2026-09-08, 노드 ID가 334:3255에서 334:3373~334:3392로 바뀐 새 버전 — 이전 실측이
// 낡은 스냅샷이었음): "장소 카드" 324x316. 사진(324x256, radius20) 위에 반투명 흰 배지(10%)+
// 하트버튼(10%), 아래 20% 검정 그라디언트로 배지/버튼 대비 확보. 이름(20/Medium)→주소(14/Regular,
// 둘 다 검정, gap 4). 실측대로면 카드 자체는 배경/그림자가 없지만, 사용자가 "취향 맞춤 코스"
// 리스트처럼 카드별로 구분되게 해달라고 요청(2026-09-09)해서 흰 카드+그림자를 다시 추가함(styles.card
// 참고). 원본엔 이름 옆에 별점(★4.0)도 있는데 PlaceListItem엔 rating 필드가 없어서(PlaceDetail에만
// 있음) 생략 — 없는 데이터를 지어내지 않기 위한 선택(다른 화면들과 동일 원칙, 사용자 확인)
function PlaceCategoryCard({
  place,
  onPress,
  onToggleLike,
}: {
  place: PlaceListItem;
  onPress: () => void;
  onToggleLike: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardImageWrap}>
        {place.main_image_url ? (
          <Image source={{ uri: place.main_image_url }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
        )}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.2)']} style={StyleSheet.absoluteFill} />
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>{place.category}</Text>
        </View>
        <TouchableOpacity style={styles.likeButton} onPress={onToggleLike} hitSlop={8}>
          {/* 하트 벡터 자체는 Figma에서 색상 실측이 안 돼서(아이콘 컴포넌트 내부 경로 비노출)
              추정 — 배지/버튼이 사진 위 반투명 흰색이라 대비상 기본은 흰색 테두리, 찜하면 빨강
              (기존엔 기본이 검정이었는데 사진 위에서 대비가 낮아 흰색으로 정정, 2026-09-08) */}
          <Text style={[styles.likeIcon, place.is_liked && styles.likeIconActive]}>
            {place.is_liked ? '♥' : '♡'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>
          {place.name}
        </Text>
        {place.addr1 && (
          <View style={styles.cardAddrRow}>
            <LocationPinIcon size={16} />
            <Text style={styles.cardAddr} numberOfLines={1}>
              {place.addr1}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  globeWrap: { alignItems: 'center' },
  markerLayer: { position: 'absolute', top: 0 },
  marker: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  markerImage: { width: '100%', height: '100%' },
  // 아래 시트 스타일은 JournalTab.tsx와 동일한 값(위치/그림자/배경) — 주석은 거기 참고
  sheetClip: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: colors.backgroundMuted,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 6,
  },
  handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 16 },
  handleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 },
  sheetTitle: {
    width: '100%',
    fontFamily: fonts.semiBold,
    fontSize: 20,
    letterSpacing: -0.5,
    lineHeight: 28,
    color: colors.black,
    // Figma 실측(334:3255 "관광지 관련 명소" 텍스트, 프레임 기준 좌측 인셋 24) — 카드 리스트
    // 패딩(18)이랑 값이 달라서 각자 따로 씀(2026-09-07 재실측 정정)
    paddingHorizontal: 24,
  },
  // Figma 실측("장소 리스트" 프레임, 좌측 인셋 18, 2026-09-08 재실측으로도 동일 확인)
  listContent: { paddingHorizontal: 18, paddingBottom: 100 },
  emptyText: { textAlign: 'center', color: colors.gray400, fontFamily: fonts.regular, fontSize: 13, marginTop: 40 },
  footerLoading: { marginVertical: 16 },
  // Figma 실측대로면 카드 자체는 배경/그림자가 없지만(2026-09-08), 사용자가 "취향 맞춤 코스"
  // 리스트처럼 카드별로 구분되게 해달라고 요청(2026-09-09) — RecommendedTab/JournalTab과 동일한
  // 흰 카드+옅은 그림자 패턴 적용. 사진 안쪽 여백/카드 사이 간격이 너무 붙어 보인다는 피드백으로
  // 패딩(4→10)·카드 간격(20→28) 확대(2026-09-09). 안쪽 radius는 바깥 radius(20)에서 패딩(10)만큼
  // 뺀 10으로(JournalTab 카드와 동일한 중첩 규칙)
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 10,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardImageWrap: {
    width: '100%',
    aspectRatio: 324 / 256,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  cardImage: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  cardImagePlaceholder: { backgroundColor: colors.border },
  categoryBadge: {
    position: 'absolute',
    left: 12,
    top: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  categoryBadgeText: { fontFamily: fonts.medium, fontSize: 14, color: colors.white },
  likeButton: {
    position: 'absolute',
    right: 12,
    top: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeIcon: { fontSize: 18, color: colors.white },
  likeIconActive: { color: '#ff4d4d' },
  cardInfo: { paddingTop: 16, paddingHorizontal: 6, paddingBottom: 8 },
  cardName: { fontFamily: fonts.medium, fontSize: 20, color: colors.black },
  cardAddrRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  cardAddr: { fontFamily: fonts.regular, fontSize: 14, color: colors.black, flexShrink: 1 },
});
