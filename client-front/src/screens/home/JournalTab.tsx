import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, FlatList, Image, PanResponder, StyleSheet, Text, View } from 'react-native';
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
// 완전히 펼쳤다가 다시 접힐 때 남은 거리가 이 값보다 작으면(=많이 끌어올렸으면) 펼침으로 스냅
const SNAP_THRESHOLD_RATIO = 0.35;

interface Props {
  onOpenLogs: () => void;
}

// Figma 노드 506:11115("메인 페이지-나의 일지"). 상단 안동 지구본(장식, 드래그로 회전)은 고정,
// 그 아래 남는 영역에 방문기록 카드 목록을 "팝업(바텀시트)" 형태로 얹음 — 평소엔 핸들+타이틀만
// 하단에 살짝 보이다가 위로 끌어올리면 지구본 바로 아래까지 꽉 차면서 안의 목록이 스크롤됨
// (2026-09-05 결정, decision-log 참고). 기존에 있던 방문기록 핀 지도와 요약 카드 자리를 이 시트가
// 대신함 — onOpenLogs prop은 지도 복귀 시 다시 쓸 예정이라 시그니처만 유지(지금은 미사용)
//
// gesture-handler/reanimated 없이 RN 코어 PanResponder+Animated만으로 구현 — 새 네이티브 의존성
// 추가하면 재빌드가 필요해서(CONTRIBUTING/decision-log 관례) 일단 이걸로. 드래그는 핸들 영역에서만
// 받고 리스트 자체엔 PanResponder를 안 걸어서 펼친 상태에서 FlatList 스크롤과 제스처가 충돌 안 함
export function JournalTab(_props: Props) {
  const [logs, setLogs] = useState<VisitLogMapItem[] | null>(null);
  const [regionHeight, setRegionHeight] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  // 시트가 끌어올려진 정도. 0 = 완전히 펼침(지구본 바로 아래까지), maxTranslate = 접힘(PEEK_HEIGHT만 노출)
  const translateY = useRef(new Animated.Value(0)).current;
  const dragBaseValue = useRef(0);
  const maxTranslate = useRef(0);

  useEffect(() => {
    visitLogApi
      .myLogs()
      .then((res) => setLogs(res.logs))
      .catch((e) => {
        Alert.alert('일지를 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
        setLogs([]);
      });
  }, []);

  // regionHeight(지구본 아래 남는 영역의 실측 높이)를 알아야 접힘 상태 오프셋을 계산할 수 있어서
  // onLayout에서 처음 잡히는 순간 접힘 상태로 초기화
  function handleRegionLayout(height: number) {
    if (regionHeight != null) return; // 회전 등으로 재측정되어도 사용자가 만든 펼침 상태를 유지
    setRegionHeight(height);
    maxTranslate.current = Math.max(0, height - PEEK_HEIGHT);
    translateY.setValue(maxTranslate.current);
  }

  function snapTo(next: boolean) {
    setExpanded(next);
    Animated.spring(translateY, {
      toValue: next ? 0 : maxTranslate.current,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 2,
      onPanResponderGrant: () => {
        dragBaseValue.current = expanded ? 0 : maxTranslate.current;
      },
      onPanResponderMove: (_, gesture) => {
        const next = clamp(dragBaseValue.current + gesture.dy, 0, maxTranslate.current);
        translateY.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        const current = clamp(dragBaseValue.current + gesture.dy, 0, maxTranslate.current);
        const shouldExpand = current < maxTranslate.current * SNAP_THRESHOLD_RATIO;
        snapTo(shouldExpand);
      },
    }),
  ).current;

  return (
    <View style={styles.container}>
      <AndongGlobe size={GLOBE_SIZE} />

      <View style={styles.sheetRegion} onLayout={(e) => handleRegionLayout(e.nativeEvent.layout.height)}>
        {regionHeight != null && (
          <Animated.View style={[styles.sheet, { height: regionHeight, transform: [{ translateY }] }]}>
            <View style={styles.handleArea} {...panResponder.panHandlers}>
              <View style={styles.handleBar} />
              <Text style={styles.sheetTitle}>안동에서의 추억</Text>
            </View>
            <FlatList
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
        )}
      </View>
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
  sheetRegion: { flex: 1, overflow: 'hidden' },
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
