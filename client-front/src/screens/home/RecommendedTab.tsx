import { useEffect, useRef, useState } from 'react';
import {
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SimilarLogItem, exploreApi } from '../../api/explore';
import { AndongGlobe } from '../../components/AndongGlobe';
import { StarRating } from '../../components/StarRating';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/fonts';
import { PlaceDetailScreen } from '../PlaceDetailScreen';

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

// Figma 노드 510:11050("메인 페이지-맞춤 코스") 실측 + JournalTab.tsx(506:11115/601:15039)의
// 팝업(바텀시트) 메커니즘 재사용. 아래 두 가지는 Figma 원안과 의도적으로 다르게 간 부분(2026-09-07
// 결정, decision-log 참고):
// 1. 배경 지도: Figma는 "출발"/"도착" 라벨이 붙은 정적 경로 일러스트(지도-2)를 쓰는데, SimilarLogItem은
//    장소 하나짜리 방문 기록이라 실제 "코스"(경로) 데이터가 없음 — 사용자가 명시적으로 "나의 일지에
//    있던 지도가 보이도록" 요청해서 JournalTab과 동일한 AndongGlobe(안동 지구본)로 대체
// 2. 사진 우상단 하트(좋아요) 버튼: SimilarLogItem과 동일한 데이터를 쓰는 ExploreScreen.tsx가 이미
//    "방문 기록 좋아요 개념 자체가 스키마에 없음"이라는 이유로 생략하기로 결정해뒀음(2026-08-31) —
//    같은 데이터라 동일한 이유로 여기서도 생략
// "선택" 버튼은 ExploreScreen.tsx와 동일하게 해당 장소 상세 화면으로 이동하는 용도로 구현
export function RecommendedTab() {
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<SimilarLogItem[] | null>(null);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<number | null>(null);

  const translateY = useRef(new Animated.Value(0)).current;
  const translateYRef = useRef(0);
  const dragBaseValue = useRef(0);
  const maxTranslate = useRef(0);
  const listRef = useRef<FlatList<SimilarLogItem>>(null);

  useEffect(() => {
    exploreApi
      .similarLogs()
      .then((res) => setLogs(res.logs))
      .catch(() => setLogs([]));
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

  if (selectedPlaceId != null) {
    return <PlaceDetailScreen placeId={selectedPlaceId} onExit={() => setSelectedPlaceId(null)} />;
  }

  return (
    <View style={styles.container} onLayout={(e) => handleContainerLayout(e.nativeEvent.layout.height)}>
      <AndongGlobe size={GLOBE_SIZE} />

      {containerHeight != null && (
        <View style={[styles.sheetClip, { height: panelHeight }]}>
          <Animated.View style={[styles.sheet, { height: panelHeight, transform: [{ translateY }] }]}>
            <View style={styles.handleArea} {...panResponder.panHandlers}>
              <View style={styles.handleBar} />
              <Text style={styles.sheetTitle}>취향이 비슷한 사용자 코스 추천</Text>
            </View>
            <FlatList
              ref={listRef}
              data={logs ?? []}
              keyExtractor={(item) => String(item.log_id)}
              scrollEnabled={expanded}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                logs != null ? (
                  <Text style={styles.emptyText}>아직 취향이 겹치는 유저의 공개 기록이 없어요</Text>
                ) : null
              }
              renderItem={({ item }) => (
                <SimilarCourseCard item={item} onSelectPlace={() => setSelectedPlaceId(item.place_id)} />
              )}
            />
          </Animated.View>
        </View>
      )}
    </View>
  );
}

// Figma 노드 507:10963/510:11050("취향 비슷 사용자 프로필") 실측값 그대로 재구현(2026-09-07).
// 사진을 넘기면 그 사진에 달린 캡션으로 설명 텍스트가 바뀜(2026-09-07 결정, decision-log 참고) —
// 캡션이 없는 사진(캡션 입력 UI가 아직 없어서 대부분 없음)은 로그 대표 한줄리뷰(one_line)로 대체
function SimilarCourseCard({ item, onSelectPlace }: { item: SimilarLogItem; onSelectPlace: () => void }) {
  const photos = item.photos;
  const [activePhoto, setActivePhoto] = useState(0);
  const caption = photos[activePhoto]?.caption ?? item.one_line;

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
            {item.tags.length > 0 && (
              <Text style={styles.tagsText}>{item.tags.slice(0, 2).map((tag) => `# ${tag}`).join('  ')}</Text>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.selectButton} onPress={onSelectPlace}>
          <Text style={styles.selectButtonText}>선택</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.textBlock}>
        <View style={styles.placeNameRow}>
          <Text style={styles.placeName}>{item.place_name}</Text>
          {item.rating != null && (
            <View style={styles.ratingRow}>
              <StarRating rating={item.rating} size={12} />
              <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
        {caption && (
          <Text style={styles.captionText} numberOfLines={2}>
            {caption}
          </Text>
        )}
      </View>

      {photos.length > 0 && (
        <View style={styles.photoBlock}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEnabled={photos.length > 1}
            onMomentumScrollEnd={(e) =>
              setActivePhoto(Math.round(e.nativeEvent.contentOffset.x / CARD_IMAGE_WIDTH))
            }
          >
            {photos.map((p, idx) => (
              <Image key={idx} source={{ uri: p.url }} style={styles.cardImage} resizeMode="cover" />
            ))}
          </ScrollView>
          {photos.length > 1 && (
            <View style={styles.dotsRow}>
              {photos.map((_, i) => (
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
  selectButton: {
    width: 48,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectButtonText: { fontFamily: fonts.medium, fontSize: 13, color: colors.black },

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
  cardImage: { width: CARD_IMAGE_WIDTH, aspectRatio: 292 / 212, borderRadius: 16 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.2)' },
  dotActive: { backgroundColor: colors.black },
});
