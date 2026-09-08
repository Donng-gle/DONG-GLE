import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingCard, onboardingApi } from '../api/onboarding';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

interface Props {
  onComplete: () => void;
}

// SSOT 온보딩 종료 조건 중 "최소 15장 진행" — 이 기준을 채워야 "맞춤 취향 분석하기"로
// 직접 끝낼 수 있게 함 (자동 수렴/25장 강제 종료는 별개로 계속 동작)
const MIN_SWIPES_TO_FINISH = 15;
const CARD_ASPECT_RATIO = 320 / 468; // Figma 노드 501:12699 카드 비율
const SWIPE_THRESHOLD = 120;

export function OnboardingScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const [card, setCard] = useState<OnboardingCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [totalSeen, setTotalSeen] = useState(0);

  // PanResponder는 마운트 시 한 번만 생성되므로, 콜백 안에서 최신 state를 읽으려면 ref로 미러링해야 함
  const cardRef = useRef(card);
  const swipingRef = useRef(swiping);
  useEffect(() => {
    cardRef.current = card;
  }, [card]);
  useEffect(() => {
    swipingRef.current = swiping;
  }, [swiping]);

  const position = useRef(new Animated.ValueXY()).current;
  const rotate = position.x.interpolate({ inputRange: [-300, 0, 300], outputRange: ['-12deg', '0deg', '12deg'] });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !swipingRef.current && !!cardRef.current,
      onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          forceSwipe('like');
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          forceSwipe('dislike');
        } else {
          Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        }
      },
    }),
  ).current;

  useEffect(() => {
    loadNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadNext() {
    setLoading(true);
    try {
      const next = await onboardingApi.getNext();
      if (!next) {
        // getNext()가 null인 이유는 두 가지: (1) 자연 수렴/25장 도달(둘 다 totalSeen >= 15가 보장됨)
        // (2) 온보딩 카드 자체가 바닥남(totalSeen < 15여도 발생 가능 — 카드 데이터 부족, milestone.md
        // 참고). (2)인데도 그냥 조용히 완료 처리하면 사용자는 왜 일찍 끝났는지 모른 채 부정확한 취향
        // 벡터로 넘어가게 됨 — 최소한 무슨 일이 있었는지는 알려줌 (2026-09-04 발견/수정, decision-log 참고)
        if (totalSeen < MIN_SWIPES_TO_FINISH) {
          Alert.alert(
            '보여드릴 사진이 더 없어요',
            `아직 ${MIN_SWIPES_TO_FINISH}장을 채우지 못했지만(${totalSeen}장 진행) 준비된 사진을 모두 확인했어요. 지금까지의 선택으로 취향을 분석할게요.`,
          );
        }
        await finishOnboarding();
        return;
      }
      setCard(next.card);
    } catch (e) {
      Alert.alert('온보딩을 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }

  async function finishOnboarding() {
    try {
      await onboardingApi.complete();
    } catch (e) {
      Alert.alert('취향 분석 완료 처리에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      onComplete();
    }
  }

  function forceSwipe(action: 'like' | 'dislike') {
    setSwiping(true);
    Animated.timing(position, {
      toValue: { x: action === 'like' ? 500 : -500, y: 0 },
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      position.setValue({ x: 0, y: 0 });
      handleSwipe(action);
    });
  }

  async function handleSwipe(action: 'like' | 'dislike') {
    // panResponder는 마운트 시(카드가 아직 null인 첫 렌더) 한 번만 생성돼서 이 함수를 클로저로
    // 캡처한다. 클로저 변수 card를 직접 읽으면 그 시점의 null에 고정돼 매번 여기서 조용히 return하고,
    // 그 위 forceSwipe에서 이미 true로 만든 swiping을 finally까지 못 가서 영영 못 내려 스와이프가
    // 완전히 멈추는 버그가 있었음 — cardRef로 최신값을 읽는다.
    const curr = cardRef.current;
    if (!curr) return;

    setSwiping(true);
    try {
      const result = await onboardingApi.swipe(curr.id, action);
      setTotalSeen(result.total_seen);
      setCard(null);

      if (result.is_converged) {
        await finishOnboarding();
        return;
      }
      await loadNext();
    } catch (e) {
      Alert.alert('스와이프에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setSwiping(false);
    }
  }

  // "내 취향 다시 분석하기" — SSOT에 명시된 리셋 플로우, 벡터가 날아가므로 확인 후 진행
  function confirmReset() {
    Alert.alert('처음부터 다시 시작할까요?', '지금까지 분석한 취향이 초기화돼요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '다시 시작',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await onboardingApi.reset();
            setTotalSeen(0);
            setCard(null);
            await loadNext();
          } catch (e) {
            Alert.alert('초기화에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
            setLoading(false);
          }
        },
      },
    ]);
  }

  const canFinishEarly = totalSeen >= MIN_SWIPES_TO_FINISH;

  if (loading || !card) {
    return (
      <View style={styles.center}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={colors.black} />
        <Text style={styles.loadingText}>취향을 분석할 사진을 준비하고 있어요</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>당신의 취향을 선택하세요</Text>
        <Text style={styles.subtitle}>
          마음에 드는 장소는 오른쪽으로, 마음에 안드는 장소는 왼쪽으로{'\n'}스와이프해주세요
        </Text>
      </View>

      <View style={styles.cardArea}>
        <View style={styles.cardStack}>
          <View style={styles.backCard} />
          <Animated.View
            {...panResponder.panHandlers}
            style={[styles.frontCard, { transform: [...position.getTranslateTransform(), { rotate }] }]}
          >
            <Image source={{ uri: card.image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.35)']} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
      </View>

      <View style={[styles.actionsRow, { paddingBottom: Math.max(20, insets.bottom + 16) }]}>
        <TouchableOpacity
          style={[styles.finishButton, canFinishEarly ? styles.finishButtonEnabled : styles.finishButtonDisabled]}
          disabled={!canFinishEarly || swiping}
          onPress={finishOnboarding}
        >
          <Text style={canFinishEarly ? styles.finishButtonTextEnabled : styles.finishButtonTextDisabled}>
            맞춤 취향 분석하기
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.resetButton} onPress={confirmReset} disabled={swiping}>
          <Text style={styles.resetIcon}>↻</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, padding: 24 },
  loadingText: { marginTop: 12, fontFamily: fonts.regular, fontSize: 14, color: colors.gray500 },
  header: { paddingHorizontal: 20 },
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
    marginBottom: 28,
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
  actionsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20 },
  finishButton: { flex: 1, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  finishButtonEnabled: { backgroundColor: colors.black },
  finishButtonDisabled: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  finishButtonTextEnabled: { fontFamily: fonts.medium, fontSize: 16, letterSpacing: -0.4, color: colors.white },
  finishButtonTextDisabled: { fontFamily: fonts.regular, fontSize: 16, letterSpacing: -0.4, color: colors.gray500 },
  resetButton: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetIcon: { fontSize: 22, color: colors.black },
});
