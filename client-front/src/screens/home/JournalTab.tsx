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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VisitLogMapItem, visitLogApi } from '../../api/visitLog';
import { AndongGlobe } from '../../components/AndongGlobe';
import { PlusIcon } from '../../components/icons';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/fonts';
import { JournalLogCreateModal } from '../JournalLogCreateModal';

const GLOBE_SIZE = Dimensions.get('window').width;

// 카드 사진 캐러셀 한 장의 너비. listContent(paddingHorizontal 20)+card(paddingHorizontal 4)
// 만큼 화면 폭에서 뺀 값 — PlaceDetailScreen의 HERO_IMAGE_WIDTH와 같은 이유로 하드코딩 대신
// 실제 렌더 폭을 씀(pagingEnabled가 어긋나면 다음 사진이 붙어 보이는 문제, decision-log 참고)
const CARD_IMAGE_WIDTH = Dimensions.get('window').width - 48;

// 핸들+타이틀만 보이는 "일부만 노출" 상태의 높이. Figma 시안(506:11115)엔 접힌 상태 프레임이
// 따로 없어서 값 자체는 임의 — 다만 핸들을 아예 안 보여주면 드래그 가능한 걸 알 기회가 없어서
// (2026-09-05 결정) 핸들+섹션 타이틀 정도는 접힌 상태에도 남겨둠
const PEEK_HEIGHT = 76;
// 접힌 상태일 때 핸들+타이틀 아래로 남겨두는 여백 — FloatingNav(하단 오프셋 12 + 높이 52 + 여백
// 8, FloatingNav.tsx 참고)가 시트 바로 앞에 떠 있어서 이 여백 없이 딱 붙이면 "안동에서의 추억"
// 타이틀이 내비 알약 뒤에 가려짐(2026-09-05 실기기 확인)
const NAV_CLEARANCE = 72;
// 완전히 펼쳤다가 다시 접힐 때 남은 거리가 이 값보다 작으면(=많이 끌어올렸으면) 펼침으로 스냅
const SNAP_THRESHOLD_RATIO = 0.35;

interface Props {
  onOpenLogs: () => void;
}

// Figma 노드 506:11115("메인 페이지-나의 일지"). 상단 안동 지구본(장식, 드래그로 회전) 위에
// 방문기록 카드 목록을 "팝업(바텀시트)" 형태로 얹음 — 평소엔 핸들+타이틀만 하단에 살짝 보이다가
// 위로 끌어올리면 지구본을 덮으면서 탭 콘텐츠 최상단까지 꽉 차고 안의 목록이 스크롤됨
// (2026-09-05 결정, decision-log 참고). 처음엔 시트가 지구본 아래 남는 공간까지만 채워지게
// 만들었었는데, 그러면 완전히 끌어올려도 지구본 사진 밑에서 한계가 생겨서(사용자 피드백,
// 2026-09-05) 지구본 위까지 덮는 오버레이로 바꿈. 기존에 있던 방문기록 핀 지도와 요약 카드
// 자리를 이 시트가 대신함 — onOpenLogs prop은 지도 복귀 시 다시 쓸 예정이라 시그니처만
// 유지(지금은 미사용)
//
// gesture-handler/reanimated 없이 RN 코어 PanResponder+Animated만으로 구현 — 새 네이티브 의존성
// 추가하면 재빌드가 필요해서(CONTRIBUTING/decision-log 관례) 일단 이걸로. 드래그는 핸들 영역에서만
// 받고 리스트 자체엔 PanResponder를 안 걸어서 펼친 상태에서 FlatList 스크롤과 제스처가 충돌 안 함
export function JournalTab(_props: Props) {
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<VisitLogMapItem[] | null>(null);
  // 지구본 아래 남는 공간이 아니라 탭 콘텐츠 전체 높이 — 시트가 지구본까지 덮으면서 펼쳐지므로
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  // 시트가 끌어올려진 정도. 0 = 완전히 펼침(탭 콘텐츠 최상단까지, 지구본을 덮음), maxTranslate = 접힘(PEEK_HEIGHT만 노출)
  const translateY = useRef(new Animated.Value(0)).current;
  // translateY의 "현재 값"을 직접 미러링하는 ref — PanResponder는 useRef로 한 번만 만들어져서
  // 그 콜백 안에서 참조하는 state(expanded)는 항상 최초 렌더 시점 값(false)에 고정되는 stale
  // closure 문제가 있음(2026-09-05 실기기 테스트 중 발견: 드래그 시작 시점 기준값이 항상 "접힘"
  // 취급돼서 이미 펼쳐진 상태에서 드래그를 시작하면 순간 점프하는 버그로 이어짐). state 대신 이
  // ref를 읽게 해서 항상 최신 값을 보게 함
  const translateYRef = useRef(0);
  const dragBaseValue = useRef(0);
  const maxTranslate = useRef(0);
  const listRef = useRef<FlatList<VisitLogMapItem>>(null);
  const [createVisible, setCreateVisible] = useState(false);

  function loadLogs() {
    visitLogApi
      .myLogs()
      .then((res) => setLogs(res.logs))
      .catch((e) => {
        Alert.alert('일지를 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
        setLogs([]);
      });
  }

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // containerHeight(탭 콘텐츠 전체 실측 높이)를 알아야 접힘 상태 오프셋을 계산할 수 있어서
  // onLayout에서 처음 잡히는 순간 접힘 상태로 초기화. onLayout이 재는 높이는 화면 물리적 끝까지
  // 포함하는데, 그 끝은 안드로이드 3버튼 내비게이션 바(반투명이라 내용이 비쳐 보임) 뒤라서 그대로
  // 쓰면 접힌 상태 핸들+타이틀이 그 바 뒤에 가려짐(2026-09-05 실기기 확인) — insets.bottom만큼
  // 빼서 시스템 바 위에서 끝나게 함
  function handleContainerLayout(height: number) {
    if (containerHeight != null) return; // 회전 등으로 재측정되어도 사용자가 만든 펼침 상태를 유지
    setContainerHeight(height);
    const panelHeight = Math.max(0, height - insets.bottom);
    maxTranslate.current = Math.max(0, panelHeight - PEEK_HEIGHT - NAV_CLEARANCE);
    translateY.setValue(maxTranslate.current);
    translateYRef.current = maxTranslate.current;
  }

  function snapTo(next: boolean) {
    setExpanded(next);
    // 접을 때 리스트가 스크롤된 채로 남아있으면 접힌 상태(peek)가 첫 카드가 아니라 스크롤해뒀던
    // 중간 카드를 보여주게 됨 — 매번 맨 위로 되돌려서 peek이 항상 타이틀+첫 카드로 보이게 함
    if (!next) listRef.current?.scrollToOffset({ offset: 0, animated: false });
    const target = next ? 0 : maxTranslate.current;
    translateYRef.current = target; // 스프링 애니메이션 도중 값이 아니라 목표값 기준(약간의 오차는 감수)
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

  return (
    <View style={styles.container} onLayout={(e) => handleContainerLayout(e.nativeEvent.layout.height)}>
      <AndongGlobe size={GLOBE_SIZE} />

      {containerHeight != null && (
        // 클리핑 경계(위치+높이)를 탭 콘텐츠 맨 위(container 기준 top:0)부터 잡아서, 시트를
        // 완전히 끌어올리면(translateY:0) 지구본을 덮으면서 탭 콘텐츠 최상단까지 꽉 참.
        // panelHeight로 높이를 미리 줄여서 클리핑 경계 자체가 안드로이드 시스템 내비게이션 바
        // 위에서 끝나게 함 — 접힌 상태에서도 시스템 바 뒤로 내용이 새어나가지 않음
        <View style={[styles.sheetClip, { height: panelHeight }]}>
          <Animated.View style={[styles.sheet, { height: panelHeight, transform: [{ translateY }] }]}>
            <View style={styles.handleArea} {...panResponder.panHandlers}>
              <View style={styles.handleBar} />
              <View style={styles.headerRow}>
                <Text style={styles.sheetTitle}>안동에서의 추억</Text>
                {/* "+"는 탭이라 PanResponder(handleArea 전체에 걸려있음)와 겹치는데, RN 터치
                    협상은 가장 안쪽(TouchableOpacity)이 먼저 응답자가 될 기회를 가져서(캡처
                    단계 핸들러를 안 쓰는 한) 드래그와 안 충돌함(2026-09-05 실기기 확인) */}
                <TouchableOpacity onPress={() => setCreateVisible(true)} hitSlop={8}>
                  <PlusIcon />
                </TouchableOpacity>
              </View>
            </View>
            <FlatList
              ref={listRef}
              data={logs ?? []}
              keyExtractor={(item) => String(item.id)}
              scrollEnabled={expanded}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                logs != null ? <Text style={styles.emptyText}>아직 방문 기록이 없어요.</Text> : null
              }
              renderItem={({ item }) => <JournalLogCard log={item} />}
            />
          </Animated.View>
        </View>
      )}

      <JournalLogCreateModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onCreated={loadLogs}
      />
    </View>
  );
}

// Figma 노드 601:15039("메인 페이지-나의 일지") 직접 확인 후 실측값 그대로 재구현(2026-09-05).
// VisitLog엔 title 컬럼이 없어서(스키마 변경 필요, 사용자 확인) place_name을 제목 자리에,
// one_line(한줄리뷰)을 그 아래 설명 자리에 대신 씀. 시안 뱃지 3개(날짜/장소/날씨) 중 날씨는
// DB에 데이터가 없어서 계속 생략(사용자 확인) — 날짜/장소 2개만 하나의 회색 바 안에 표시.
// 별점(rating)은 시안에 아예 없는 요소라 이 카드에선 제외(장소 상세 등 다른 화면에서 계속 노출).
function JournalLogCard({ log }: { log: VisitLogMapItem }) {
  // 사진별 캡션 지원(2026-09-07 결정, decision-log 참고)으로 photo_urls(문자열 배열)에서
  // photos({url,caption}[])로 바뀜 — 나의 일지 카드는 캡션을 안 쓰고 계속 one_line만 표시(장소
  // 상세 리뷰와 동일한 경계 판단)이라 url만 꺼내서 씀
  const photos = log.photos;
  const [activePhoto, setActivePhoto] = useState(0);
  return (
    <View style={styles.card}>
      {photos.length > 0 && (
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
      )}
      {/* 사진 여러 장 지원(2026-09-06, decision-log 참고) — photos 배열 길이만큼 점이 늘어나고
          현재 스와이프 위치(activePhoto)에 맞는 점만 활성 스타일로 표시.
          조건을 photos.length > 1로 좁혀서 사진 1장일 땐 이 View 자체를 안 그렸더니, 이미지-본문
          사이 간격(marginTop 8 + marginBottom 12)이 이 View에만 붙어있어서 사진 1장인 카드(3번째
          카드부터 대부분 여기 해당)는 사진과 글 사이 간격이 통째로 사라져 버렸음(2026-09-06 사용자
          피드백 "세 번째 카드부터 글이랑 사진 간격이 너무 가깝다"). 사진이 있으면 이 View 자체는
          항상 그리고(간격 유지), 점 표시만 2장 이상일 때로 제한 */}
      {photos.length > 0 && (
        <View style={styles.cardDotsRow}>
          {photos.length > 1 && photos.map((_, i) => (
            <View key={i} style={[styles.cardDot, i === activePhoto && styles.cardDotActive]} />
          ))}
        </View>
      )}
      <View style={styles.cardTextArea}>
        {/* title 컬럼 2026-09-05 추가(기록하기 화면과 같이 도입) — 그 전에 작성된 기록은
            title이 없을 수 있어서 place_name으로 대체 표시 */}
        <Text style={styles.cardTitle}>{log.title ?? log.place_name}</Text>
        <Text style={styles.cardDescription} numberOfLines={2}>
          {log.one_line ?? '(한줄리뷰 없음)'}
        </Text>
      </View>
      <View style={styles.cardBadgeBar}>
        <View style={styles.cardBadgeItem}>
          <Text style={styles.cardBadgeIcon}>📅</Text>
          <Text style={styles.cardBadgeText}>{formatVisitDay(log.visited_at)}</Text>
        </View>
        <View style={styles.cardBadgeItem}>
          <Text style={styles.cardBadgeIcon}>📍</Text>
          <Text style={styles.cardBadgeText}>{log.place_name}</Text>
        </View>
        {/* weather도 title과 같이 2026-09-05 추가 — 옛 기록엔 없을 수 있어서 있을 때만 표시 */}
        {log.weather && (
          <View style={styles.cardBadgeItem}>
            <Text style={styles.cardBadgeIcon}>☁️</Text>
            <Text style={styles.cardBadgeText}>{log.weather}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// 시안은 "8월 24일(월)"처럼 정확한 날짜+요일 표기 — 장소 상세 리뷰(PlaceDetailScreen.
// formatVisitMonth)는 다른 사람 글이라 연/월까지만 보여주지만, 나의 일지는 본인 기록이라
// 정확한 날짜를 보여줘도 프라이버시 문제 없음(2026-09-05 결정)
function formatVisitDay(visitedAt: string) {
  const d = new Date(visitedAt);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${days[d.getDay()]})`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // container 전체(지구본 포함)를 덮는 오버레이라 top:0부터 시작 — 지구본은 이 View보다 먼저
  // 렌더돼서 z-order상 아래 깔림, 시트가 펼쳐지면 그 위를 덮으며 올라옴
  sheetClip: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    // Figma 실측(2026-09-05, 노드 601:15039 직접 확인) 결과 시트가 흰 패널이 아니라 페이지
    // 배경(#f7f7fb=backgroundMuted)과 같은 색이고, 그 위에 카드만 흰색+그림자로 떠 있는 구조였음
    // — 이전엔 시트 자체를 흰 패널로 만들어서 카드(흰색)와 구분이 안 됐던 게 진짜 원인
    backgroundColor: colors.backgroundMuted,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 6,
  },
  // paddingBottom 16 = Figma 실측 "제목→첫 카드" 간격(16, 노드 601:15039 "00에서의 추억"
  // 텍스트 바닥~카드 상단) 그대로. handleBar 자체는 Figma엔 없는 우리 쪽 드래그 어포던스라
  // 그 위 paddingTop/marginBottom 값은 임의(2026-09-05 결정, 위 주석 참고)
  handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 16 },
  handleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 },
  // Figma: 타이틀 좌측, "+" 우측 정렬(593:12649 "플러스" 인스턴스가 프레임 오른쪽 끝에 배치됨)
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  // Figma 실측: fontSize 20 / SemiBold / letterSpacing -0.5 / lineHeight 28 (노드 601:15203
  // "00에서의 추억") — 이전 버전은 카드 안쪽 제목("일기 제목", fontSize16)과 헷갈려서 잘못 적용함
  sheetTitle: { fontFamily: fonts.semiBold, fontSize: 20, letterSpacing: -0.5, lineHeight: 28, color: colors.black },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  emptyText: { textAlign: 'center', color: colors.gray400, fontFamily: fonts.regular, fontSize: 13, marginTop: 40 },
  // 아래 카드 스타일 전부 Figma 노드 601:15039("메인 페이지-나의 일지") 실측값 그대로 —
  // export_node_as_image로 실제 렌더 이미지까지 확인해서 흰 카드+옅은 그림자(테두리 아님) 구조로
  // 재작성함(2026-09-05, 이전 버전엔 테두리를 썼는데 시안엔 그림자만 있었음)
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingTop: 4,
    paddingHorizontal: 4,
    paddingBottom: 16,
    // marginBottom:12 — Figma 실측 카드 사이 간격(2026-09-06 사용자 확인: 헤더→첫 카드 간격과
    // 다르게 카드-카드 간격 자체는 원래 시안값대로 유지). 한때 이 값을 없앤 적 있었는데(같은 날
    // "간격이 안 맞다" 피드백을 카드 사이 간격 문제로 잘못 짚어서) 사용자가 실제 문제는 카드
    // "안"의 사진↔글 간격이라고 정정해줘서 되돌림 — 카드 사이 간격은 그대로 Figma값 유지
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  // Figma 316x236 비율 그대로(aspectRatio) — 이전엔 고정 height:180이라 카드 폭 대비 사진이
  // 납작해 보였음(사용자 피드백 "사진 크기 좀 더 키우고")
  // 여러 장 캐러셀(가로 ScrollView) 안에 들어가서 퍼센트 대신 실제 픽셀 폭(CARD_IMAGE_WIDTH)을
  // 써야 함 — 퍼센트면 가로 스크롤 콘텐츠 크기가 잡히지 않음(2026-09-06, 여러 장 지원 추가)
  cardImage: { width: CARD_IMAGE_WIDTH, aspectRatio: 316 / 236, borderRadius: 12 },
  // 여러 장 스와이프 시 페이지를 나타내는 점(2026-09-05 처음 배열 기반으로 구현, 2026-09-06
  // photo_urls 여러 장 지원으로 실제로 늘어나게 됨, decision-log 참고) — photos.length만큼 점이
  // 그려지고 현재 스와이프 위치(activePhoto)에 맞는 점만 활성 스타일
  cardDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 12,
  },
  cardDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.2)' },
  cardDotActive: { width: 20, backgroundColor: colors.black },
  cardTextArea: { paddingHorizontal: 12 },
  cardTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    letterSpacing: -0.4,
    color: colors.black,
    textAlign: 'center',
    marginBottom: 4,
  },
  cardDescription: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: 12,
  },
  // 시안엔 뱃지 3개(날짜/장소/날씨)가 각자 알약이 아니라 하나로 이어진 회색 바 안에 나란히 들어있음
  // — 이전 버전은 날짜/장소를 각각 별도 알약으로 잘못 만들었던 부분.
  // marginHorizontal:8 — card의 paddingHorizontal:4와 합쳐 총 12px 인셋(Figma 실측: 뱃지 바
  // 좌우 여백 12, 사진 4/제목·설명 16과 다 다름 — 처음엔 8로 잘못 계산해서 다시 고침, 2026-09-05).
  // gap:16 — Figma 실측 뱃지 그룹 사이 간격(날짜↔장소, 원래 3칸 중 첫 두 칸 사이 간격 그대로)
  cardBadgeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: colors.border,
    borderRadius: 100,
    paddingVertical: 10,
    marginHorizontal: 8,
  },
  cardBadgeItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardBadgeIcon: { fontSize: 12 },
  cardBadgeText: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray500 },
});
