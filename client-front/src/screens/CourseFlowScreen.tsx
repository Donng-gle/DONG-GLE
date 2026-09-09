import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SwipeCandidate, SwipedResultItem, SwipeTransport, swipeApi } from '../api/swipe';
import { swipeSessionStorage } from '../storage/swipeSessionStorage';
import { CalendarPicker } from '../components/CalendarPicker';
import { TimePicker } from '../components/TimePicker';
import { ChevronDownIcon, ClockIcon } from '../components/icons';
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
      startTime: string | null;
      endTime: string | null;
    }
  | {
      name: 'result';
      sessionId: string;
      travelDate: string;
      transport: SwipeTransport;
      startTime: string | null;
      endTime: string | null;
    };

const TODAY = new Date().toISOString().slice(0, 10);

// Figma 드롭다운(691:12626) 순서 그대로(도보/대중교통/자동차) — 예전 버튼형 UI 때 순서(도보/자동차/
// 대중교통)와 다름
const TRANSPORT_OPTIONS: { value: SwipeTransport; label: string }[] = [
  { value: 'walk', label: '도보' },
  { value: 'public', label: '대중교통' },
  { value: 'car', label: '자동차' },
];

function formatDateLabel(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()];
  return `${y}년 ${m}월 ${d}일 (${weekday})`;
}

// "HH:mm"(24시간) -> "오전 7:55" — TimePicker.tsx의 12시간 표기 규칙과 맞춤
function formatTimeLabel(time: string) {
  const [h, m] = time.split(':').map(Number);
  const isPM = h >= 12;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${isPM ? '오후' : '오전'} ${h12}:${String(m).padStart(2, '0')}`;
}

// 코스 만들기 전체 흐름의 오케스트레이터: 조건 입력(setup) → 스와이프(swiping) → 코스 생성/저장(result)
export function CourseFlowScreen({ onExit }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>({ name: 'setup' });
  const [travelDate, setTravelDate] = useState(TODAY);
  const [transport, setTransport] = useState<SwipeTransport>('walk');
  const [showCalendar, setShowCalendar] = useState(false);
  const [loading, setLoading] = useState(false);
  // 시작/종료 시간 — Figma "일정 만들기-세부 사항"(691:11920/691:12626, 채널 3ussd0cc)에 있는
  // 필드인데, api/swipe.ts의 SwipeCandidatesRequest엔 이 값을 받는 필드 자체가 아직 없음(백엔드
  // 미지원, 2026-09-09 확인) — 그래서 UI로 값은 받아두지만 startSwipe() 호출엔 안 실어 보냄.
  // 백엔드에서 실제로 이 시간대로 후보를 거르거나 코스 시간을 맞추게 하려면 별도 API 작업 필요
  // (사용자에게 확인 필요, decision-log 미기록 상태)
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [timePickerField, setTimePickerField] = useState<'start' | 'end' | null>(null);
  const [transportOpen, setTransportOpen] = useState(false);
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
        // 스와이프는 이미 다 끝났는데 코스 생성까지 못 갔던 경우 — 결과 화면으로 바로 이동.
        // 시작/종료 시간은 세션 복원 시엔 원래 고른 값을 알 방법이 없어서(서버에 저장 안 됨,
        // api/swipe.ts SwipeSessionDetail 참고) null로 두고 서버 기본값(09:00~21:00)에 맡김
        // (2026-09-09 추가)
        await swipeSessionStorage.clear();
        setStep({
          name: 'result',
          sessionId: savedSessionId,
          travelDate: detail.travel_date,
          transport: detail.transport,
          startTime: null,
          endTime: null,
        });
        setCheckingResume(false);
        return;
      }

      // 스와이프 결과 제출(POST /swipe/sessions/:id/results)은 마지막 카드까지 다 넘긴 뒤 한 번에만
      // 일어나는 구조라, 이 시점엔 하나도 제출된 게 없다(swiped_results는 항상 빈 배열). 그래서
      // "이어서 진행할까요?"처럼 스와이프 진행 상황이 남아있는 것처럼 물어보면 사실과 다름 — 실제로는
      // 같은 조건(날짜·이동수단)의 후보 목록을 다시 쓸지, 새 조건으로 다시 뽑을지의 선택일 뿐이라 그에
      // 맞게 문구를 고침 (2026-09-04 발견/수정, decision-log 참고)
      Alert.alert('만들다 만 코스가 있어요', '같은 조건(날짜·이동수단)으로 이어서 만들까요?', [
        {
          text: '새 조건으로 시작',
          style: 'destructive',
          onPress: async () => {
            await swipeSessionStorage.clear();
            setCheckingResume(false);
          },
        },
        {
          text: '이어서 만들기',
          onPress: () => {
            setStep({
              name: 'swiping',
              sessionId: savedSessionId,
              candidates: detail.candidates,
              initialResults: detail.swiped_results,
              travelDate: detail.travel_date,
              transport: detail.transport,
              // 위 result 분기와 동일한 이유로 복원 시엔 알 수 없음(서버 기본값에 맡김)
              startTime: null,
              endTime: null,
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
        startTime,
        endTime,
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
          setStep({
            name: 'result',
            sessionId: step.sessionId,
            travelDate: step.travelDate,
            transport: step.transport,
            startTime: step.startTime,
            endTime: step.endTime,
          });
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
        startTime={step.startTime}
        endTime={step.endTime}
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
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>여행일정 등록</Text>
        <Text style={styles.subtitle}>선택해주신 정보들로 일정을 만들어드립니다.</Text>

        {/* 여행 날짜 — Figma "세부 사항" 프레임엔 이 필드가 안 보이지만(날짜는 다른 화면에서 이미
            고르고 들어온다는 전제로 보임), 이 흐름엔 date-first 단계가 따로 없고 travel_date는
            API 필수값이라 생략할 수 없어서 기존 필드를 그대로 유지(CourseDetailScreen이 시안에 없는
            "코스 삭제"를 유지한 것과 같은 판단, 2026-09-09) */}
        <Text style={styles.label}>여행 날짜</Text>
        <TouchableOpacity style={styles.fieldButton} onPress={() => setShowCalendar(true)}>
          <Text style={styles.fieldButtonText}>{formatDateLabel(travelDate)}</Text>
        </TouchableOpacity>

        <Text style={[styles.label, styles.labelSpaced]}>시작시간</Text>
        <TouchableOpacity style={styles.fieldButton} onPress={() => setTimePickerField('start')}>
          <Text style={[styles.fieldButtonText, !startTime && styles.fieldButtonPlaceholder]}>
            {startTime ? formatTimeLabel(startTime) : '-----'}
          </Text>
          <ClockIcon size={20} />
        </TouchableOpacity>

        <Text style={[styles.label, styles.labelSpaced]}>종료시간</Text>
        <TouchableOpacity style={styles.fieldButton} onPress={() => setTimePickerField('end')}>
          <Text style={[styles.fieldButtonText, !endTime && styles.fieldButtonPlaceholder]}>
            {endTime ? formatTimeLabel(endTime) : '-----'}
          </Text>
          <ClockIcon size={20} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <Text style={styles.label}>이동수단</Text>
        <TouchableOpacity style={styles.fieldButton} onPress={() => setTransportOpen(!transportOpen)}>
          <Text style={styles.fieldButtonText}>{TRANSPORT_OPTIONS.find((o) => o.value === transport)?.label}</Text>
          <ChevronDownIcon size={16} open={transportOpen} />
        </TouchableOpacity>
        {transportOpen && (
          <View>
            {TRANSPORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={styles.dropdownItem}
                onPress={() => {
                  setTransport(option.value);
                  setTransportOpen(false);
                }}
              >
                <Text style={styles.dropdownItemText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.actions, { paddingBottom: Math.max(20, insets.bottom + 16) }]}>
        <TouchableOpacity style={styles.primaryButton} onPress={startSwipe} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>선택하기</Text>}
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

      <TimePicker
        visible={timePickerField != null}
        value={(timePickerField === 'start' ? startTime : endTime) ?? (timePickerField === 'start' ? '09:00' : '18:00')}
        onClose={() => setTimePickerField(null)}
        onConfirm={(time) => {
          if (timePickerField === 'start') setStartTime(time);
          else if (timePickerField === 'end') setEndTime(time);
          setTimePickerField(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8 },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 20, color: colors.black },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  // Figma "일정 만들기-세부 사항"(691:11920/691:12626, 채널 3ussd0cc, 2026-09-09) 실측
  title: { fontFamily: fonts.semiBold, fontSize: 20, color: colors.black },
  subtitle: { fontFamily: fonts.regular, fontSize: 15, color: colors.gray500, marginTop: 8, marginBottom: 32 },
  label: { fontFamily: fonts.regular, fontSize: 16, color: colors.black, marginBottom: 8 },
  labelSpaced: { marginTop: 28 },
  fieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
  },
  fieldButtonText: { fontFamily: fonts.regular, fontSize: 16, letterSpacing: -0.4, color: colors.black },
  fieldButtonPlaceholder: { color: colors.gray500 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 32 },
  dropdownItem: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  dropdownItemText: { fontFamily: fonts.regular, fontSize: 16, letterSpacing: -0.4, color: colors.black },
  actions: { paddingHorizontal: 20 },
  primaryButton: { height: 52, borderRadius: 8, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.24, color: colors.white },
});
