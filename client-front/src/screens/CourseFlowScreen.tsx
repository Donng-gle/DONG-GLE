import { useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SwipeCandidate, SwipeTransport, swipeApi } from '../api/swipe';
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

  // mood_tags/preferred_categories는 비워서 보냄 — 서버가 user_preference 상위 태그로 자동 추천
  async function startSwipe() {
    setLoading(true);
    try {
      const response = await swipeApi.createSession({ travel_date: travelDate, transport });
      if (response.candidates.length === 0) {
        Alert.alert('추천할 장소가 없어요', '조건을 바꿔서 다시 시도해주세요.');
        return;
      }
      setStep({
        name: 'swiping',
        sessionId: response.session_id,
        candidates: response.candidates,
        travelDate,
        transport,
      });
    } catch (e) {
      Alert.alert('후보를 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }

  if (step.name === 'swiping') {
    return (
      <CourseSwipeScreen
        sessionId={step.sessionId}
        candidates={step.candidates}
        onDone={() =>
          setStep({ name: 'result', sessionId: step.sessionId, travelDate: step.travelDate, transport: step.transport })
        }
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
