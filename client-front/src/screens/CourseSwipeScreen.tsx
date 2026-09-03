import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SwipeAction, SwipeCandidate, SwipedResultItem, swipeApi } from '../api/swipe';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

interface Props {
  sessionId: string;
  candidates: SwipeCandidate[];
  // 세션 복구 시 이미 스와이프한 결과(GET /swipe/sessions/:id의 swiped_results) — 최종 제출에 합쳐서 보냄
  initialResults?: SwipedResultItem[];
  onDone: () => void;
}

const CARD_ASPECT_RATIO = 320 / 468; // OnboardingScreen과 동일 카드 비율 사용
const SWIPE_THRESHOLD = 120;

// 온보딩 스와이프(OnboardingScreen)와 시각 언어는 통일하되, 여기는 3가지 결과(좋아요/넘기기/꼭 가기)가
// 있어서 좌우 드래그(좋아요/넘기기)에 "꼭 가기" 버튼을 추가로 둠 — 디자인 시안(510:11265)이 실제로는
// 온보딩 스와이프 프레임을 그대로 복제해둔 것뿐이라 별도 스펙이 없어 이 화면 자체 판단으로 구성함
// (2026-09-01 결정, decision-log 참고). 서버가 후보를 한 번에 다 내려주므로 로컬에서 인덱스만 넘기다가
// 마지막 카드에서 한 번에 결과를 제출한다 (POST /swipe/sessions/:id/results)
export function CourseSwipeScreen({ sessionId, candidates, initialResults = [], onDone }: Props) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<SwipedResultItem[]>(initialResults);
  const [submitting, setSubmitting] = useState(false);

  const current = candidates[index];
  const currentRef = useRef(current);
  const submittingRef = useRef(submitting);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  const position = useRef(new Animated.ValueXY()).current;
  const rotate = position.x.interpolate({ inputRange: [-300, 0, 300], outputRange: ['-12deg', '0deg', '12deg'] });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !submittingRef.current && !!currentRef.current,
      onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          forceSwipe('like');
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          forceSwipe('skip');
        } else {
          Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        }
      },
    }),
  ).current;

  function forceSwipe(action: SwipeAction) {
    Animated.timing(position, {
      toValue: { x: action === 'like' ? 500 : action === 'skip' ? -500 : 0, y: action === 'must' ? -600 : 0 },
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      position.setValue({ x: 0, y: 0 });
      handleAction(action);
    });
  }

  async function handleAction(action: SwipeAction) {
    if (!current || submitting) return;
    const next = [...results, { place_id: current.place_id, action }];

    if (index + 1 < candidates.length) {
      setResults(next);
      setIndex(index + 1);
      return;
    }

    setSubmitting(true);
    try {
      await swipeApi.submitResults(sessionId, { swipes: next });
      onDone();
    } catch (e) {
      Alert.alert('결과 제출에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
      setSubmitting(false);
    }
  }

  if (submitting || !current) {
    return (
      <View style={styles.center}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={colors.black} />
        <Text style={styles.loadingText}>결과를 저장하고 있어요</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.title}>가고 싶은 곳을 골라주세요</Text>
        <Text style={styles.subtitle}>
          마음에 드는 장소는 오른쪽으로, 넘길 장소는 왼쪽으로{'\n'}스와이프해주세요
        </Text>
      </View>

      <View style={styles.cardArea}>
        <View style={styles.cardStack}>
          <View style={styles.backCard} />
          <Animated.View
            {...panResponder.panHandlers}
            style={[styles.frontCard, { transform: [...position.getTranslateTransform(), { rotate }] }]}
          >
            {current.main_image_url ? (
              <Image source={{ uri: current.main_image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.imagePlaceholder]} />
            )}
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={StyleSheet.absoluteFill} />
            <View style={styles.cardInfo}>
              <Text style={styles.placeName}>{current.name}</Text>
              <Text style={styles.placeCategory}>{current.category}</Text>
              {current.tags.length > 0 && <Text style={styles.placeTags}>{current.tags.join(' · ')}</Text>}
            </View>
          </Animated.View>
        </View>
      </View>

      <View style={[styles.bottomRow, { paddingBottom: Math.max(20, insets.bottom + 16) }]}>
        <Text style={styles.progressText}>
          {index + 1} / {candidates.length}
        </Text>
        <TouchableOpacity style={styles.mustButton} onPress={() => forceSwipe('must')}>
          <Text style={styles.mustButtonText}>꼭 가기 ★</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, padding: 24 },
  loadingText: { marginTop: 12, fontFamily: fonts.regular, fontSize: 14, color: colors.gray500 },
  header: { paddingHorizontal: 20, paddingTop: 20 },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.5,
    color: colors.black,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16.8,
    letterSpacing: -0.3,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: 12,
  },
  cardArea: { flex: 1, paddingHorizontal: 20 },
  cardStack: { width: '100%', aspectRatio: CARD_ASPECT_RATIO },
  backCard: {
    position: 'absolute',
    top: 60,
    left: 14,
    right: 14,
    bottom: -18,
    borderRadius: 28,
    backgroundColor: colors.border,
  },
  frontCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  imagePlaceholder: { backgroundColor: colors.border },
  cardInfo: { position: 'absolute', left: 20, right: 20, bottom: 20 },
  placeName: { fontFamily: fonts.semiBold, fontSize: 20, letterSpacing: -0.5, color: colors.white },
  placeCategory: { fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  placeTags: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  bottomRow: { paddingHorizontal: 20, paddingTop: 12, alignItems: 'center', gap: 12 },
  progressText: { fontFamily: fonts.regular, fontSize: 13, color: colors.gray500 },
  mustButton: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mustButtonText: { fontFamily: fonts.semiBold, fontSize: 15, letterSpacing: -0.3, color: colors.black },
});
