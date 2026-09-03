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
    if (!card) return;

    setSwiping(true);
    try {
      const result = await onboardingApi.swipe(card.id, action);
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
