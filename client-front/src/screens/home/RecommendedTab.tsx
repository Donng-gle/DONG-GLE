import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CourseDetail, CoursePlaceItem } from '../../api/course';
import { SimilarCourseItem, exploreApi } from '../../api/explore';
import { AndongGlobe } from '../../components/AndongGlobe';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/fonts';
import { PublicCourseDetailScreen } from '../PublicCourseDetailScreen';

const GLOBE_SIZE = Dimensions.get('window').width;

// 카드 사진 캐러셀 한 장의 너비. listContent(paddingHorizontal 20)+card(paddingHorizontal 16)
// 만큼 화면 폭에서 뺀 값 — JournalTab의 CARD_IMAGE_WIDTH와 같은 이유(카드마다 좌우 패딩이 달라서
// 각자 계산, decision-log 참고)
const CARD_IMAGE_WIDTH = Dimensions.get('window').width - 72;

// 아래 4개 상수는 JournalTab.tsx와 완전히 동일 — 이 탭도 "나의 일지처럼 팝업 형태로" 만들어달라는
// 요청(2026-09-07 결정, decision-log 참고)이라 바텀시트 여닫힘 동작 자체를 그대로 재사용함
const PEEK_HEIGHT = 76;
const NAV_CLEARANCE = 72;
const SNAP_THRESHOLD_RATIO = 0.35;

// Figma 노드 507:10963/510:11050("메인 페이지-맞춤 코스") 실측 + JournalTab.tsx의 팝업(바텀시트)
// 메커니즘 재사용. 카드는 원래 "유사 사용자 탐색"(방문 기록 1건)을 썼었는데(2026-08-31 결정),
// 사용자가 "선택 → 지도에 간단한 경로 미리보기 → 자세히 보기 → 직접 일정 만들기와 같은 코스 상세
// 화면"을 요청하면서 실제 COURSE(여러 장소로 구성된 코스) 데이터로 전면 교체(2026-09-07 결정,
// decision-log 참고) — 방문 기록 1건짜리 카드로는 "코스"를 보여줄 수 없었음.
//
// Figma 원안과 의도적으로 다르게 간 부분:
// 1. 배경 지도: 평소엔 나의 일지와 동일한 AndongGlobe(사용자 명시 요청). "선택" 시엔 Figma의
//    정적 출발/도착 일러스트 대신 실제 MapView+Polyline으로 대체 — "자세히 보기"(PublicCourseDetailScreen)도
//    실제 지도를 쓰므로 같은 방식이 일관적이고, 코스마다 장소 수가 다를 수 있어 정적 2점 일러스트로는
//    표현이 안 됨
// 2. 사진 우상단 하트(좋아요) 버튼: ExploreScreen.tsx가 이미 "방문 기록 좋아요 개념이 스키마에
//    없음"으로 생략한 선례를 그대로 따름(코스에도 좋아요 개념 없음)
export function RecommendedTab() {
  const insets = useSafeAreaInsets();
  const [courses, setCourses] = useState<SimilarCourseItem[] | null>(null);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedCourseDetail, setSelectedCourseDetail] = useState<CourseDetail | null>(null);
  const [detailCourseId, setDetailCourseId] = useState<number | null>(null);

  const translateY = useRef(new Animated.Value(0)).current;
  const translateYRef = useRef(0);
  const dragBaseValue = useRef(0);
  const maxTranslate = useRef(0);
  const listRef = useRef<FlatList<SimilarCourseItem>>(null);

  useEffect(() => {
    exploreApi
      .similarCourses()
      .then((res) => setCourses(res.courses))
      .catch(() => setCourses([]));
  }, []);

  // JournalTab.handleContainerLayout과 동일 — 접힘 상태 오프셋 계산 로직 그대로
  function handleContainerLayout(height: number) {
    if (containerHeight != null) return;
    setContainerHeight(height);
    const panelHeight = Math.max(0, height - insets.bottom);
    maxTranslate.current = Math.max(0, panelHeight - PEEK_HEIGHT - NAV_CLEARANCE);
    translateY.setValue(maxTranslate.current);
    translateYRef.current = maxTranslate.current;
  }

  function snapTo(next: boolean) {
    setExpanded(next);
    if (!next) listRef.current?.scrollToOffset({ offset: 0, animated: false });
    const target = next ? 0 : maxTranslate.current;
    translateYRef.current = target;
    Animated.spring(translateY, {
      toValue: target,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
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
        const shouldExpand = current < maxTranslate.current * SNAP_THRESHOLD_RATIO;
        snapTo(shouldExpand);
      },
    }),
  ).current;

  const panelHeight = containerHeight != null ? Math.max(0, containerHeight - insets.bottom) : 0;

  // "선택" — 코스 상세(좌표+경로)를 불러와서 지도 미리보기로 바꾸고, 지도가 보이도록 시트를 접음.
  // 버튼은 이 코스가 selectedCourseId가 되면 "자세히 보기"로 바뀜(카드 렌더링 참고)
  async function handleSelectCourse(courseId: number) {
    setSelectedCourseId(courseId);
    try {
      const detail = await exploreApi.getCourseDetail(courseId);
      setSelectedCourseDetail(detail);
      snapTo(false);
    } catch (e) {
      Alert.alert('코스를 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
      setSelectedCourseId(null);
    }
  }

  if (detailCourseId != null) {
    return <PublicCourseDetailScreen courseId={detailCourseId} onExit={() => setDetailCourseId(null)} />;
  }

  return (
    <View style={styles.container} onLayout={(e) => handleContainerLayout(e.nativeEvent.layout.height)}>
      {selectedCourseDetail ? (
        <CourseRoutePreviewMap course={selectedCourseDetail} size={GLOBE_SIZE} />
      ) : (
        <AndongGlobe size={GLOBE_SIZE} />
      )}

      {containerHeight != null && (
        <View style={[styles.sheetClip, { height: panelHeight }]}>
          <Animated.View style={[styles.sheet, { height: panelHeight, transform: [{ translateY }] }]}>
            <View style={styles.handleArea} {...panResponder.panHandlers}>
              <View style={styles.handleBar} />
              <Text style={styles.sheetTitle}>취향이 비슷한 사용자 코스 추천</Text>
            </View>
            <FlatList
              ref={listRef}
              data={courses ?? []}
              keyExtractor={(item) => String(item.course_id)}
              scrollEnabled={expanded}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                courses != null ? (
                  <Text style={styles.emptyText}>아직 취향이 겹치는 유저의 공개 코스가 없어요</Text>
                ) : null
              }
              renderItem={({ item }) => (
                <SimilarCourseCard
                  item={item}
                  isSelected={item.course_id === selectedCourseId}
                  onSelect={() => handleSelectCourse(item.course_id)}
                  onViewDetail={() => setDetailCourseId(item.course_id)}
                />
              )}
            />
          </Animated.View>
        </View>
      )}
    </View>
  );
}

// "선택"된 코스의 장소들을 실제 지도 위에 마커+경로로 보여줌(2026-09-07 결정, decision-log 참고).
// PublicCourseDetailScreen/CourseDetailScreen의 지도 블록과 같은 패턴(MapView+Polyline)이지만
// 카드 미리보기용이라 번호 핀 대신 첫/마지막 장소만 "출발"/"도착"으로 라벨링(장소가 2곳 초과면
// 중간은 방문 순서 번호)
function CourseRoutePreviewMap({ course, size }: { course: CourseDetail; size: number }) {
  const pinned = course.places.filter((p) => p.lat != null && p.lng != null);
  if (pinned.length === 0) {
    return <View style={[styles.mapFallback, { width: size, height: size }]} />;
  }

  const coords = pinned.map((p) => ({ latitude: p.lat as number, longitude: p.lng as number }));

  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={{ width: size, height: size }}
      initialRegion={regionForCoords(coords)}
    >
      {coords.length > 1 && (
        <Polyline coordinates={coords} strokeColor={colors.accentBlue} strokeWidth={3} />
      )}
      {pinned.map((p, idx) => (
        <Marker key={p.place_id} coordinate={{ latitude: p.lat as number, longitude: p.lng as number }}>
          <View style={styles.previewPin}>
            <Text style={styles.previewPinText}>{previewPinLabel(p, idx, pinned.length)}</Text>
          </View>
        </Marker>
      ))}
    </MapView>
  );
}

function previewPinLabel(place: CoursePlaceItem, index: number, total: number): string {
  if (total <= 1) return place.name;
  if (index === 0) return '출발';
  if (index === total - 1) return '도착';
  return String(place.visit_order);
}

// 모든 좌표가 화면에 들어오도록 중심+델타를 계산 — 코스마다 장소 수/범위가 달라서 고정 리전 대신
// 매번 bounding box로 계산(*1.6 여유는 CourseDetailScreen이 안 쓰는 값이라 이 화면 전용 조정)
function regionForCoords(coords: { latitude: number; longitude: number }[]) {
  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.02),
    longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.02),
  };
}

// Figma 노드 507:10963/510:11050("취향 비슷 사용자 프로필") 실측값 그대로 재구현(2026-09-07,
// 방문 기록 1건 → 실제 코스로 데이터가 바뀌면서 place_name/rating/tags는 카드에서 빠짐).
// 사진(장소 미리보기)을 넘기면 그 장소 이름으로 설명 텍스트가 바뀜
function SimilarCourseCard({
  item,
  isSelected,
  onSelect,
  onViewDetail,
}: {
  item: SimilarCourseItem;
  isSelected: boolean;
  onSelect: () => void;
  onViewDetail: () => void;
}) {
  const previews = item.place_previews;
  const [activePhoto, setActivePhoto] = useState(0);
  const caption = previews[activePhoto]?.name ?? null;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.profileRow}>
          {item.profile_image_url ? (
            <Image source={{ uri: item.profile_image_url }} style={styles.avatar} resizeMode="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]} />
          )}
          <View style={styles.nameCategory}>
            <Text style={styles.nickname}>{item.nickname}</Text>
            <Text style={styles.tagsText}>{item.place_count}곳 코스</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.selectButton, isSelected && styles.selectButtonActive]}
          onPress={isSelected ? onViewDetail : onSelect}
        >
          <Text style={[styles.selectButtonText, isSelected && styles.selectButtonTextActive]}>
            {isSelected ? '자세히 보기' : '선택'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.textBlock}>
        <Text style={styles.placeName}>{item.title}</Text>
        {caption && (
          <Text style={styles.captionText} numberOfLines={2}>
            {caption}
          </Text>
        )}
      </View>

      {previews.length > 0 && (
        <View style={styles.photoBlock}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEnabled={previews.length > 1}
            onMomentumScrollEnd={(e) =>
              setActivePhoto(Math.round(e.nativeEvent.contentOffset.x / CARD_IMAGE_WIDTH))
            }
          >
            {previews.map((p, idx) =>
              p.thumbnail_url ? (
                <Image key={idx} source={{ uri: p.thumbnail_url }} style={styles.cardImage} resizeMode="cover" />
              ) : (
                <View key={idx} style={[styles.cardImage, styles.cardImagePlaceholder]} />
              ),
            )}
          </ScrollView>
          {previews.length > 1 && (
            <View style={styles.dotsRow}>
              {previews.map((_, i) => (
                <View key={i} style={[styles.dot, i === activePhoto && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapFallback: { backgroundColor: colors.backgroundMuted },
  previewPin: {
    paddingHorizontal: 8,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  previewPinText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.white },
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
  handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 16, paddingHorizontal: 20 },
  handleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 },
  sheetTitle: {
    width: '100%',
    fontFamily: fonts.semiBold,
    fontSize: 20,
    letterSpacing: -0.5,
    lineHeight: 28,
    color: colors.black,
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  emptyText: { textAlign: 'center', color: colors.gray400, fontFamily: fonts.regular, fontSize: 13, marginTop: 40 },

  // 카드 스타일 전부 Figma 노드 507:10963/510:11050 실측값 그대로. JournalLogCard와 같은
  // 흰 카드+옅은 그림자(테두리 아님) 구조를 그대로 따름
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 8 },
  avatarPlaceholder: { backgroundColor: colors.border },
  nameCategory: { flex: 1 },
  nickname: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.black },
  tagsText: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray500, marginTop: 4 },
  // width 고정 대신 minWidth — "선택"(2글자)/"자세히 보기"(5글자) 둘 다 담아야 해서(2026-09-07
  // 추가, Figma엔 "선택" 상태만 있어서 48 고정폭이었음)
  selectButton: {
    minWidth: 48,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Figma 510:11050 첫 카드의 파란 채움 "선택" 상태(507:10973과 다른 변형)를 "선택됨" 표시로 사용
  selectButtonActive: { backgroundColor: colors.accentBlue, borderColor: colors.accentBlue },
  selectButtonText: { fontFamily: fonts.medium, fontSize: 13, color: colors.black },
  selectButtonTextActive: { color: colors.white },

  textBlock: { marginTop: 16 },
  placeName: { fontFamily: fonts.medium, fontSize: 16, letterSpacing: -0.4, lineHeight: 22, color: colors.black },
  // Figma 시안 폰트웨이트는 Light(300)인데 앱엔 Regular/Medium/SemiBold/Bold 4종만 번들돼 있어서
  // (App.tsx useFonts 참고) 가장 가까운 Regular로 대체 — 새 폰트 파일 추가는 이번 범위 밖
  captionText: {
    fontFamily: fonts.regular,
    fontSize: 16,
    letterSpacing: -0.4,
    lineHeight: 22,
    color: colors.gray700,
    marginTop: 8,
  },

  photoBlock: { marginTop: 16 },
  cardImage: { width: CARD_IMAGE_WIDTH, aspectRatio: 292 / 212, borderRadius: 16 },
  cardImagePlaceholder: { backgroundColor: colors.border },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.2)' },
  dotActive: { backgroundColor: colors.black },
});
