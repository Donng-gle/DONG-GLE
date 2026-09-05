import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, FlatList, Image, PanResponder, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VisitLogMapItem, visitLogApi } from '../../api/visitLog';
import { AndongGlobe } from '../../components/AndongGlobe';
import { StarRating } from '../../components/StarRating';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/fonts';

const GLOBE_SIZE = Dimensions.get('window').width;

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

  useEffect(() => {
    visitLogApi
      .myLogs()
      .then((res) => setLogs(res.logs))
      .catch((e) => {
        Alert.alert('일지를 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
        setLogs([]);
      });
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
              <Text style={styles.sheetTitle}>안동에서의 추억</Text>
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
    </View>
  );
}

function JournalLogCard({ log }: { log: VisitLogMapItem }) {
  return (
    <View style={styles.card}>
      {log.photo_url && <Image source={{ uri: log.photo_url }} style={styles.cardImage} resizeMode="cover" />}
      <Text style={styles.cardTitle}>{log.one_line ?? '(한줄리뷰 없음)'}</Text>
      <View style={styles.cardMetaRow}>
        <Text style={styles.cardMetaText}>{log.place_name}</Text>
        {log.rating != null && <StarRating rating={log.rating} size={12} />}
        <Text style={styles.cardMetaText}>{formatVisitMonth(log.visited_at)}</Text>
      </View>
    </View>
  );
}

// Figma 리뷰 카드 관례("OOOO년 O월 여행")와 동일 — PlaceDetailScreen.formatVisitMonth 참고
function formatVisitMonth(visitedAt: string) {
  const d = new Date(visitedAt);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 여행`;
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
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 6,
  },
  handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 12 },
  handleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 },
  sheetTitle: { fontFamily: fonts.semiBold, fontSize: 16, letterSpacing: -0.4, color: colors.black },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  emptyText: { textAlign: 'center', color: colors.gray400, fontFamily: fonts.regular, fontSize: 13, marginTop: 40 },
  card: { marginBottom: 20 },
  cardImage: { width: '100%', height: 180, borderRadius: 12, marginBottom: 10 },
  cardTitle: { fontFamily: fonts.medium, fontSize: 15, letterSpacing: -0.4, color: colors.black, marginBottom: 6 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardMetaText: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray500 },
});
