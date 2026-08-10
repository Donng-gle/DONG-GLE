import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { OnboardingCard, onboardingApi } from '../api/onboarding';

interface Props {
  onComplete: () => void;
}

const MAX_CARDS = 25;

export function OnboardingScreen({ onComplete }: Props) {
  const [card, setCard] = useState<OnboardingCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [totalSeen, setTotalSeen] = useState(0);

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

  async function handleSwipe(action: 'like' | 'dislike') {
    if (!card || swiping) return;

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
      setSwiping(false);
    } finally {
      setSwiping(false);
    }
  }

  if (loading || !card) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>취향을 분석할 사진을 준비하고 있어요</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>{totalSeen} / 최대 {MAX_CARDS}장</Text>
      </View>

      <View style={styles.card}>
        <Image source={{ uri: card.image_url }} style={styles.image} resizeMode="cover" />
      </View>

      <Text style={styles.instruction}>이 사진, 마음에 드시나요?</Text>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.button, styles.dislikeButton]}
          onPress={() => handleSwipe('dislike')}
          disabled={swiping}
        >
          <Text style={styles.dislikeButtonText}>싫어요</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.likeButton]}
          onPress={() => handleSwipe('like')}
          disabled={swiping}
        >
          <Text style={styles.likeButtonText}>좋아요</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 24 },
  loadingText: { marginTop: 12, color: '#666', fontSize: 14 },
  progressRow: { alignItems: 'center', marginBottom: 16 },
  progressText: { color: '#999', fontSize: 13 },
  card: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#eee',
  },
  image: { width: '100%', height: '100%' },
  instruction: { textAlign: 'center', fontSize: 16, fontWeight: '600', marginVertical: 20 },
  buttons: { flexDirection: 'row', gap: 12 },
  button: { flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  dislikeButton: { backgroundColor: '#f1f1f1' },
  likeButton: { backgroundColor: '#ff5a5f' },
  dislikeButtonText: { fontSize: 16, fontWeight: '700', color: '#222' },
  likeButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
