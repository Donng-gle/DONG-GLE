import { useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SwipeAction, SwipeCandidate, SwipedResultItem, swipeApi } from '../api/swipe';

interface Props {
  sessionId: string;
  candidates: SwipeCandidate[];
  // 세션 복구 시 이미 스와이프한 결과(GET /swipe/sessions/:id의 swiped_results) — 최종 제출에 합쳐서 보냄
  initialResults?: SwipedResultItem[];
  onDone: () => void;
}

// 온보딩 스와이프(OnboardingScreen)와 달리 여기는 서버가 후보를 한 번에 다 내려주므로,
// 로컬에서 인덱스만 넘기다가 마지막 카드에서 한 번에 결과를 제출한다 (POST /swipe/sessions/:id/results).
export function CourseSwipeScreen({ sessionId, candidates, initialResults = [], onDone }: Props) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<SwipedResultItem[]>(initialResults);
  const [submitting, setSubmitting] = useState(false);

  const current = candidates[index];

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
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>결과를 저장하고 있어요</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.progressText}>
        {index + 1} / {candidates.length}
      </Text>

      <View style={styles.card}>
        {current.main_image_url ? (
          <Image source={{ uri: current.main_image_url }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]} />
        )}
        <Text style={styles.placeName}>{current.name}</Text>
        <Text style={styles.placeCategory}>{current.category}</Text>
        {current.tags.length > 0 && <Text style={styles.placeTags}>{current.tags.join(' · ')}</Text>}
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity style={[styles.button, styles.skipButton]} onPress={() => handleAction('skip')}>
          <Text style={styles.skipButtonText}>넘기기</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.likeButton]} onPress={() => handleAction('like')}>
          <Text style={styles.likeButtonText}>좋아요</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.mustButton]} onPress={() => handleAction('must')}>
          <Text style={styles.mustButtonText}>꼭 가기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 24 },
  loadingText: { marginTop: 12, color: '#666', fontSize: 14 },
  progressText: { textAlign: 'center', color: '#999', fontSize: 13, marginBottom: 16 },
  card: { flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#f8f8f8' },
  image: { width: '100%', height: '70%' },
  imagePlaceholder: { backgroundColor: '#eee' },
  placeName: { fontSize: 18, fontWeight: '700', marginTop: 12, marginHorizontal: 16 },
  placeCategory: { fontSize: 13, color: '#666', marginTop: 4, marginHorizontal: 16 },
  placeTags: { fontSize: 12, color: '#999', marginTop: 4, marginHorizontal: 16, marginBottom: 12 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 20 },
  button: { flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  skipButton: { backgroundColor: '#f1f1f1' },
  likeButton: { backgroundColor: '#ff5a5f' },
  mustButton: { backgroundColor: '#222' },
  skipButtonText: { fontSize: 15, fontWeight: '700', color: '#222' },
  likeButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  mustButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
