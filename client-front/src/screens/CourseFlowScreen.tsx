import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SwipeCandidate, SwipedResultItem, SwipeTransport, swipeApi } from '../api/swipe';
import { swipeSessionStorage } from '../storage/swipeSessionStorage';
import { CourseSwipeScreen } from './CourseSwipeScreen';
import { CourseResultScreen } from './CourseResultScreen';

interface Props {
  onExit: () => void;
}

type Step =
  | { name: 'setup' }
  | {
      name: 'swiping';
      sessionId: string;
      candidates: SwipeCandidate[];
      initialResults: SwipedResultItem[];
      travelDate: string;
      transport: SwipeTransport;
    }
  | { name: 'result'; sessionId: string; travelDate: string; transport: SwipeTransport };

const TODAY = new Date().toISOString().slice(0, 10);

const TRANSPORT_OPTIONS: { value: SwipeTransport; label: string }[] = [
  { value: 'walk', label: '도보' },
  { value: 'car', label: '자동차' },
  { value: 'public', label: '대중교통' },
];

// 코스 만들기 전체 흐름의 오케스트레이터: 조건 입력(setup) → 스와이프(swiping) → 코스 생성/저장(result).
// 디자인 시안이 아직 없어서 화면 구성은 최소한으로만 잡고, API 요청/응답 연결 자체를 먼저 완성했다.
export function CourseFlowScreen({ onExit }: Props) {
  const [step, setStep] = useState<Step>({ name: 'setup' });
  const [travelDate, setTravelDate] = useState(TODAY);
  const [transport, setTransport] = useState<SwipeTransport>('walk');
  const [loading, setLoading] = useState(false);
  const [checkingResume, setCheckingResume] = useState(true);

  useEffect(() => {
    checkForResumableSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 앱이 백그라운드/종료됐다 돌아왔을 때 진행 중이던 스와이프 세션(GET /swipe/sessions/:id)이 있으면
  // 이어할지 물어본다. 세션이 만료됐거나(410) 없으면(404) 조용히 정리하고 새로 시작하도록 둠
  async function checkForResumableSession() {
    const savedSessionId = await swipeSessionStorage.load();
    if (!savedSessionId) {
      setCheckingResume(false);
      return;
    }

    try {
      const detail = await swipeApi.getSession(savedSessionId);

      if (detail.candidates.length === 0) {
        // 스와이프는 이미 다 끝났는데 코스 생성까지 못 갔던 경우 — 결과 화면으로 바로 이동
        await swipeSessionStorage.clear();
        setStep({ name: 'result', sessionId: savedSessionId, travelDate: detail.travel_date, transport: detail.transport });
        setCheckingResume(false);
        return;
      }

      Alert.alert('진행 중이던 스와이프가 있어요', '이어서 진행할까요?', [
        {
          text: '새로 시작',
          style: 'destructive',
          onPress: async () => {
            await swipeSessionStorage.clear();
            setCheckingResume(false);
          },
        },
        {
          text: '이어하기',
          onPress: () => {
            setStep({
              name: 'swiping',
              sessionId: savedSessionId,
              candidates: detail.candidates,
              initialResults: detail.swiped_results,
              travelDate: detail.travel_date,
              transport: detail.transport,
            });
            setCheckingResume(false);
          },
        },
      ]);
    } catch {
      await swipeSessionStorage.clear();
      setCheckingResume(false);
    }
  }

  // mood_tags/preferred_categories는 비워서 보냄 — 서버가 user_preference 상위 태그로 자동 추천
  async function startSwipe() {
    setLoading(true);
    try {
      const response = await swipeApi.createSession({ travel_date: travelDate, transport });
      if (response.candidates.length === 0) {
        Alert.alert('추천할 장소가 없어요', '조건을 바꿔서 다시 시도해주세요.');
        return;
      }
      await swipeSessionStorage.save(response.session_id);
      setStep({
        name: 'swiping',
        sessionId: response.session_id,
        candidates: response.candidates,
        initialResults: [],
        travelDate,
        transport,
      });
    } catch (e) {
      Alert.alert('후보를 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }

  if (checkingResume) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (step.name === 'swiping') {
    return (
      <CourseSwipeScreen
        sessionId={step.sessionId}
        candidates={step.candidates}
        initialResults={step.initialResults}
        onDone={async () => {
          await swipeSessionStorage.clear();
          setStep({ name: 'result', sessionId: step.sessionId, travelDate: step.travelDate, transport: step.transport });
        }}
      />
    );
  }

  if (step.name === 'result') {
    return (
      <CourseResultScreen
        sessionId={step.sessionId}
        travelDate={step.travelDate}
        transport={step.transport}
        onSaved={onExit}
        onCancel={onExit}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>코스 만들기</Text>

      <Text style={styles.label}>여행 날짜 (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        value={travelDate}
        onChangeText={setTravelDate}
        placeholder="2026-09-01"
        autoCapitalize="none"
      />

      <Text style={styles.label}>이동 수단</Text>
      <View style={styles.transportRow}>
        {TRANSPORT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[styles.transportOption, transport === option.value && styles.transportOptionSelected]}
            onPress={() => setTransport(option.value)}
          >
            <Text
              style={[styles.transportOptionText, transport === option.value && styles.transportOptionTextSelected]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.actions}>
        <Button title={loading ? '불러오는 중...' : '추천 장소 보기'} onPress={startSwipe} disabled={loading} />
        <View style={styles.gap} />
        <Button title="취소" onPress={onExit} disabled={loading} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 24 },
  label: { fontSize: 13, color: '#666', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 20,
  },
  transportRow: { flexDirection: 'row', gap: 8, marginBottom: 32 },
  transportOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  transportOptionSelected: { backgroundColor: '#ff5a5f', borderColor: '#ff5a5f' },
  transportOptionText: { fontSize: 14, color: '#222' },
  transportOptionTextSelected: { color: '#fff', fontWeight: '700' },
  actions: { marginTop: 'auto' },
  gap: { height: 12 },
});
