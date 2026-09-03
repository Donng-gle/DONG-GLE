import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SwipeCandidate, SwipedResultItem, SwipeTransport, swipeApi } from '../api/swipe';
import { swipeSessionStorage } from '../storage/swipeSessionStorage';
import { CalendarPicker } from '../components/CalendarPicker';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
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

function formatDateLabel(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()];
  return `${y}년 ${m}월 ${d}일 (${weekday})`;
}

// 코스 만들기 전체 흐름의 오케스트레이터: 조건 입력(setup) → 스와이프(swiping) → 코스 생성/저장(result)
export function CourseFlowScreen({ onExit }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>({ name: 'setup' });
  const [travelDate, setTravelDate] = useState(TODAY);
  const [transport, setTransport] = useState<SwipeTransport>('walk');
  const [showCalendar, setShowCalendar] = useState(false);
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
        <ActivityIndicator size="large" color={colors.black} />
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
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onExit} hitSlop={8} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI로 코스 만들기</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>여행 날짜</Text>
        <TouchableOpacity style={styles.fieldButton} onPress={() => setShowCalendar(true)}>
          <Text style={styles.fieldButtonText}>{formatDateLabel(travelDate)}</Text>
        </TouchableOpacity>

        <Text style={[styles.label, styles.labelSpaced]}>이동 수단</Text>
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
      </View>

      <View style={[styles.actions, { paddingBottom: Math.max(20, insets.bottom + 16) }]}>
        <TouchableOpacity style={styles.primaryButton} onPress={startSwipe} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>추천 장소 보기</Text>
          )}
        </TouchableOpacity>
      </View>

      <CalendarPicker
        visible={showCalendar}
        value={travelDate}
        minDate={TODAY}
        onClose={() => setShowCalendar(false)}
        onConfirm={(date) => {
          setTravelDate(date);
          setShowCalendar(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 8 },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 20, color: colors.black },
  headerTitle: { fontFamily: fonts.semiBold, fontSize: 17, letterSpacing: -0.4, color: colors.black },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  label: { fontFamily: fonts.medium, fontSize: 14, letterSpacing: -0.35, color: colors.black, marginBottom: 8 },
  labelSpaced: { marginTop: 28 },
  fieldButton: {
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  fieldButtonText: { fontFamily: fonts.regular, fontSize: 15, color: colors.black },
  transportRow: { flexDirection: 'row', gap: 8 },
  transportOption: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  transportOptionSelected: { backgroundColor: colors.black, borderColor: colors.black },
  transportOptionText: { fontFamily: fonts.medium, fontSize: 14, color: colors.gray700 },
  transportOptionTextSelected: { color: colors.white },
  actions: { paddingHorizontal: 20 },
  primaryButton: { height: 52, borderRadius: 8, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.24, color: colors.white },
});
