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
import MapView, { Marker, Polyline } from 'react-native-maps';
import { MAP_PROVIDER } from '../../utils/mapProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoursePlaceItem } from '../../api/course';
import { SimilarCourseItem, SimilarLogItem, exploreApi } from '../../api/explore';
import { AndongGlobe } from '../../components/AndongGlobe';
import { ReportBlockMenu } from '../../components/ReportBlockMenu';
import { StarRating } from '../../components/StarRating';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/fonts';
import { PlaceDetailScreen } from '../PlaceDetailScreen';

// 정사각형(가로=세로 기준) 지구본이라 폭을 그대로 세로 크기로도 씀 — 아이패드에서 "아이폰용 앱"이
// Stage Manager 창으로 뜰 때 창 폭이 아이폰보다 훨씬 커질 수 있어서, 430(실존 아이폰 최대 폭)으로
// 상한을 둬서 지구본이 화면보다 커져 아래 콘텐츠를 밀어내는 걸 방지 (App Review Guideline 4 대응,
// 2026-09-18). 모든 실제 아이폰은 폭이 430 이하라 이 변경으로 아이폰 화면은 전혀 안 바뀜
const GLOBE_SIZE = Math.min(Dimensions.get('window').width, 430);

// 카드 사진 캐러셀 한 장의 너비. listContent(paddingHorizontal 20)+card(paddingHorizontal 16)
// 만큼 화면 폭에서 뺀 값 — JournalTab의 CARD_IMAGE_WIDTH와 같은 이유(카드마다 좌우 패딩이 달라서
// 각자 계산, decision-log 참고). 페이징 스냅 기준(ScrollView 실제 렌더 폭)이라 절대 캡핑하면 안 됨
const CARD_IMAGE_WIDTH = Dimensions.get('window').width - 72;

// 실제로 사진을 보여줄 폭 — CARD_IMAGE_WIDTH는 그대로 두고(페이징 어긋남 방지), Image 자체만
// 이걸로 캡핑해서 페이지 안에서 가운데 정렬(430=아이폰 최대 폭, App Review Guideline 4 대응,
// 2026-09-18). 아이폰은 항상 CARD_IMAGE_WIDTH <= 358이라 기존과 동일
const CARD_IMAGE_DISPLAY_WIDTH = Math.min(CARD_IMAGE_WIDTH, 430 - 72);

// 아래 4개 상수는 JournalTab.tsx와 완전히 동일 — 이 탭도 "나의 일지처럼 팝업 형태로" 만들어달라는
// 요청(2026-09-07 결정, decision-log 참고)이라 바텀시트 여닫힘 동작 자체를 그대로 재사용함
const PEEK_HEIGHT = 76;
const NAV_CLEARANCE = 72;
const SNAP_THRESHOLD_RATIO = 0.35;

// 코스 "자세히 보기"는 HomeScreen이 전체 화면 overlay로 띄움(2026-09-10 변경, 사용자 지적 —
// 이 탭 안에서 로컬 state로만 화면을 바꾸면 AppHeader/탭바가 위에 그대로 남아있어서 "팝업"처럼
// 보임). 개별 장소(PlaceDetailScreen)는 이번 요청 범위가 아니라 기존처럼 로컬 state 유지
interface Props {
  onOpenCourseDetail: (courseId: number) => void;
}

// "취향 맞춤 코스" 탭 리스트 항목 — 코스(여러 장소)와 개별 장소(방문 기록 1건)를 같은 카드
// 디자인으로 섞어서 보여줌(2026-09-07 결정, decision-log 참고). "선택"/"자세히 보기"의 목적지만
// 다름 — 코스는 PublicCourseDetailScreen(HomeScreen이 전체 화면으로 띄움), 장소는
// PlaceDetailScreen(관광지 상세, 이 탭 로컬 state)
type RecommendedItem =
  | { kind: 'course'; data: SimilarCourseItem }
  | { kind: 'place'; data: SimilarLogItem };

function itemKey(item: RecommendedItem): string {
  return item.kind === 'course' ? `course-${item.data.course_id}` : `place-${item.data.log_id}`;
}

// "선택" 시 지도 미리보기에 찍는 점 하나 — 코스는 장소마다, 개별 장소는 그 장소 하나뿐
interface PreviewPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
}

// Figma 노드 507:10963/510:11050("메인 페이지-맞춤 코스") 실측 + JournalTab.tsx의 팝업(바텀시트)
// 메커니즘 재사용. 카드는 원래 "유사 사용자 탐색"(방문 기록 1건)만 썼다가(2026-08-31 결정) 사용자
// 요청으로 실제 COURSE 데이터로 전면 교체했었는데(2026-09-07 결정), 개별 장소도 이 탭에서 계속
// 확인할 수 있어야 한다는 요청으로 두 데이터(코스+개별 장소)를 같은 카드 디자인으로 섞어서 보여줌
// (2026-09-07 결정, decision-log 참고)
//
// Figma 원안과 의도적으로 다르게 간 부분:
// 1. 배경 지도: 평소엔 나의 일지와 동일한 AndongGlobe(사용자 명시 요청). "선택" 시엔 Figma의
//    정적 출발/도착 일러스트 대신 실제 MapView+Polyline/마커로 대체
// 2. 사진 우상단 하트(좋아요) 버튼: ExploreScreen.tsx가 이미 "방문 기록 좋아요 개념이 스키마에
//    없음"으로 생략한 선례를 그대로 따름
export function RecommendedTab({ onOpenCourseDetail }: Props) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<RecommendedItem[] | null>(null);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [previewPoints, setPreviewPoints] = useState<PreviewPoint[] | null>(null);
  const [detailPlaceId, setDetailPlaceId] = useState<number | null>(null);

  const translateY = useRef(new Animated.Value(0)).current;
  const translateYRef = useRef(0);
  const dragBaseValue = useRef(0);
  const maxTranslate = useRef(0);
  const listRef = useRef<FlatList<RecommendedItem>>(null);

  useEffect(() => {
    Promise.all([exploreApi.similarCourses(), exploreApi.similarLogs()])
      .then(([coursesRes, logsRes]) => {
        const courseItems: RecommendedItem[] = coursesRes.courses.map((c) => ({ kind: 'course', data: c }));
        const placeItems: RecommendedItem[] = logsRes.logs.map((l) => ({ kind: 'place', data: l }));
        setItems([...courseItems, ...placeItems]);
      })
      .catch(() => setItems([]));
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

  // "선택" 누르면 이미 시트가 접혀서(snapTo(false)) 지도가 보이게 되는데, 다시 "자세히 보기"를
  // 누르려면 그 카드를 찾아 스크롤해야 해서 번거로움 — 선택한 카드를 리스트 맨 앞으로 옮겨서,
  // 시트가 접힐 때 같이 실행되는 "리스트 맨 위로 스크롤"(snapTo 안의 scrollToOffset)과 맞물려
  // 접힌 상태에서 보이는 첫 카드가 곧 방금 선택한 카드(이제 "자세히 보기")가 되게 함 — 별도
  // "자세히 보기" 버튼을 새로 안 만들고 기존 카드를 재사용(2026-09-08 결정, decision-log 참고)
  function moveSelectedToFront(key: string) {
    setItems((prev) => {
      if (!prev) return prev;
      const idx = prev.findIndex((it) => itemKey(it) === key);
      if (idx <= 0) return prev;
      const next = [...prev];
      const [selected] = next.splice(idx, 1);
      next.unshift(selected);
      return next;
    });
  }

  // "선택"(코스) — 코스 상세(좌표+경로)를 불러와서 지도 미리보기로 바꾸고, 지도가 보이도록 시트를 접음
  async function handleSelectCourse(course: SimilarCourseItem) {
    const key = itemKey({ kind: 'course', data: course });
    setSelectedKey(key);
    moveSelectedToFront(key);
    try {
      const detail = await exploreApi.getCourseDetail(course.course_id);
      const pinned = detail.places.filter((p) => p.lat != null && p.lng != null);
      setPreviewPoints(
        pinned.map((p, idx) => ({
          id: String(p.place_id),
          lat: p.lat as number,
          lng: p.lng as number,
          label: previewPinLabel(p, idx, pinned.length),
        })),
      );
      snapTo(false);
    } catch (e) {
      Alert.alert('코스를 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
      setSelectedKey(null);
    }
  }

  // "선택"(개별 장소) — 이미 좌표를 들고 있어서(SimilarLogItem.lat/lng) 별도 조회 없이 바로 미리보기.
  // 좌표가 없는 장소면 미리보기만 못 보여줄 뿐 선택 자체는 막지 않음(자세히 보기는 계속 가능)
  function handleSelectPlace(log: SimilarLogItem) {
    const key = itemKey({ kind: 'place', data: log });
    setSelectedKey(key);
    moveSelectedToFront(key);
    if (log.lat != null && log.lng != null) {
      setPreviewPoints([{ id: String(log.place_id), lat: log.lat, lng: log.lng, label: log.place_name }]);
    } else {
      setPreviewPoints(null);
    }
    snapTo(false);
  }

  if (detailPlaceId != null) {
    return <PlaceDetailScreen placeId={detailPlaceId} onExit={() => setDetailPlaceId(null)} />;
  }

  return (
    <View style={styles.container} onLayout={(e) => handleContainerLayout(e.nativeEvent.layout.height)}>
      {previewPoints ? <RoutePreviewMap points={previewPoints} size={GLOBE_SIZE} /> : <AndongGlobe size={GLOBE_SIZE} />}

      {containerHeight != null && (
        <View style={[styles.sheetClip, { height: panelHeight }]}>
          <Animated.View style={[styles.sheet, { height: panelHeight, transform: [{ translateY }] }]}>
            <View style={styles.handleArea} {...panResponder.panHandlers}>
              <View style={styles.handleBar} />
              <Text style={styles.sheetTitle}>취향이 비슷한 사용자 코스 추천</Text>
            </View>
            <FlatList
              ref={listRef}
              data={items ?? []}
              keyExtractor={itemKey}
              scrollEnabled={expanded}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                items != null ? (
                  <Text style={styles.emptyText}>아직 취향이 겹치는 유저의 공개 코스/기록이 없어요</Text>
                ) : null
              }
              renderItem={({ item }) => (
                <SimilarItemCard
                  item={item}
                  isSelected={itemKey(item) === selectedKey}
                  onSelect={() =>
                    item.kind === 'course' ? handleSelectCourse(item.data) : handleSelectPlace(item.data)
                  }
                  onViewDetail={() =>
                    item.kind === 'course' ? onOpenCourseDetail(item.data.course_id) : setDetailPlaceId(item.data.place_id)
                  }
                  onBlocked={() =>
                    setItems((prev) => prev?.filter((i) => i.data.author_user_id !== item.data.author_user_id) ?? prev)
                  }
                />
              )}
            />
          </Animated.View>
        </View>
      )}
    </View>
  );
}

// "선택"된 항목의 좌표를 실제 지도 위에 마커(+2개 이상이면 경로)로 보여줌(2026-09-07 결정,
// decision-log 참고). 코스든 개별 장소든 PreviewPoint 배열만 받으면 동일하게 그림
function RoutePreviewMap({ points, size }: { points: PreviewPoint[]; size: number }) {
  if (points.length === 0) {
    return <View style={[styles.mapFallback, { width: size, height: size }]} />;
  }

  const coords = points.map((p) => ({ latitude: p.lat, longitude: p.lng }));

  return (
    <MapView
      provider={MAP_PROVIDER}
      style={{ width: size, height: size }}
      initialRegion={regionForCoords(coords)}
    >
      {coords.length > 1 && (
        <Polyline coordinates={coords} strokeColor={colors.accentBlue} strokeWidth={3} />
      )}
      {points.map((p) => (
        <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lng }}>
          <View style={styles.previewPin}>
            <Text style={styles.previewPinText}>{p.label}</Text>
          </View>
        </Marker>
      ))}
    </MapView>
  );
}

// 코스 미리보기 전용 라벨 규칙 — 장소가 2곳이면 "출발"/"도착", 3곳 이상이면 중간은 방문 순서 번호.
// 개별 장소(1곳)는 이 함수를 안 타고 RecommendedTab에서 바로 장소 이름을 라벨로 씀
function previewPinLabel(place: CoursePlaceItem, index: number, total: number): string {
  if (total <= 1) return place.name;
  if (index === 0) return '출발';
  if (index === total - 1) return '도착';
  return String(place.visit_order);
}

// 모든 좌표가 화면에 들어오도록 중심+델타를 계산 — 코스마다 장소 수/범위가 달라서 고정 리전 대신
// 매번 bounding box로 계산(*1.6 여유는 CourseDetailScreen이 안 쓰는 값이라 이 화면 전용 조정).
// 점이 1개뿐이면 delta가 0이 되므로 최소값(0.02)으로 바닥을 깜(개별 장소 미리보기용)
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

// 카드 하나에 표시할 사진(또는 장소 미리보기) + 캡션 슬라이드 — 코스/개별 장소 데이터 모양이 달라서
// 카드 렌더링 전에 공통 형태로 정규화(2026-09-07 결정, decision-log 참고)
interface CardSlide {
  url: string | null;
  caption: string | null;
}

function slidesFor(item: RecommendedItem): CardSlide[] {
  if (item.kind === 'course') {
    return item.data.place_previews.map((p) => ({ url: p.thumbnail_url, caption: p.name }));
  }
  return item.data.photos.map((p) => ({ url: p.url, caption: p.caption }));
}

// Figma 노드 507:10963/510:11050("취향 비슷 사용자 프로필") 실측값 그대로 재구현(2026-09-07).
// 코스/개별 장소 둘 다 같은 레이아웃을 쓰되(사용자 요청 "디자인은 동일하게"), 상단 보조 텍스트
// (코스 수 vs 태그)와 제목 줄(코스 제목 vs 장소명+별점)만 종류별로 다르게 채움
function SimilarItemCard({
  item,
  isSelected,
  onSelect,
  onViewDetail,
  onBlocked,
}: {
  item: RecommendedItem;
  isSelected: boolean;
  onSelect: () => void;
  onViewDetail: () => void;
  onBlocked: () => void;
}) {
  const { data } = item;
  const slides = slidesFor(item);
  const [activePhoto, setActivePhoto] = useState(0);
  const slideCaption = slides[activePhoto]?.caption ?? null;
  // 개별 장소는 슬라이드(사진)에 캡션이 없으면 로그 대표 한줄리뷰로 대체 — 코스는 place_previews의
  // name이 항상 있어서 폴백이 필요 없음
  const caption = slideCaption ?? (item.kind === 'place' ? item.data.one_line : null);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.profileRow}>
          {data.profile_image_url ? (
            <Image source={{ uri: data.profile_image_url }} style={styles.avatar} resizeMode="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]} />
          )}
          <View style={styles.nameCategory}>
            <Text style={styles.nickname}>{data.nickname}</Text>
            {item.kind === 'course' ? (
              <Text style={styles.tagsText}>{item.data.place_count}곳 코스</Text>
            ) : (
              item.data.tags.length > 0 && (
                <Text style={styles.tagsText}>{item.data.tags.slice(0, 2).map((tag) => `# ${tag}`).join('  ')}</Text>
              )
            )}
          </View>
        </View>
        <View style={styles.topRowActions}>
          <ReportBlockMenu
            authorUserId={data.author_user_id}
            targetType={item.kind === 'course' ? 'course' : 'visit_log'}
            targetId={item.kind === 'course' ? item.data.course_id : item.data.log_id}
            onBlocked={onBlocked}
          />
          <TouchableOpacity
            style={[styles.selectButton, isSelected && styles.selectButtonActive]}
            onPress={isSelected ? onViewDetail : onSelect}
          >
            <Text style={[styles.selectButtonText, isSelected && styles.selectButtonTextActive]}>
              {isSelected ? '자세히 보기' : '선택'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.textBlock}>
        <View style={styles.placeNameRow}>
          <Text style={styles.placeName}>{item.kind === 'course' ? item.data.title : item.data.place_name}</Text>
          {item.kind === 'place' && item.data.rating != null && (
            <View style={styles.ratingRow}>
              <StarRating rating={item.data.rating} size={12} />
              <Text style={styles.ratingText}>{item.data.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
        {caption && (
          <Text style={styles.captionText} numberOfLines={2}>
            {caption}
          </Text>
        )}
      </View>

      {slides.length > 0 && (
        <View style={styles.photoBlock}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEnabled={slides.length > 1}
            onMomentumScrollEnd={(e) =>
              setActivePhoto(Math.round(e.nativeEvent.contentOffset.x / CARD_IMAGE_WIDTH))
            }
          >
            {slides.map((s, idx) => (
              // 페이지 폭은 CARD_IMAGE_WIDTH(실제 ScrollView 렌더 폭)로 고정, 안의 이미지만
              // CARD_IMAGE_DISPLAY_WIDTH로 캡핑해 가운데 정렬 — 페이징 스냅이 안 어긋나게 함
              <View key={idx} style={{ width: CARD_IMAGE_WIDTH, alignItems: 'center' }}>
                {s.url ? (
                  <Image source={{ uri: s.url }} style={styles.cardImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
                )}
              </View>
            ))}
          </ScrollView>
          {slides.length > 1 && (
            <View style={styles.dotsRow}>
              {slides.map((_, i) => (
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
  topRowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  placeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  placeName: { fontFamily: fonts.medium, fontSize: 16, letterSpacing: -0.4, lineHeight: 22, color: colors.black },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontFamily: fonts.regular, fontSize: 13, color: colors.black },
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
  // width는 CARD_IMAGE_WIDTH(페이징 기준) 대신 캡핑된 CARD_IMAGE_DISPLAY_WIDTH — 감싸는 페이지
  // View(width: CARD_IMAGE_WIDTH, alignItems:'center')가 페이징 폭을 그대로 유지해줌(2026-09-18)
  cardImage: { width: CARD_IMAGE_DISPLAY_WIDTH, aspectRatio: 292 / 212, borderRadius: 16 },
  cardImagePlaceholder: { backgroundColor: colors.border },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.2)' },
  dotActive: { backgroundColor: colors.black },
});
