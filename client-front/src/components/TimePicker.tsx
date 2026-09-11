import { useEffect, useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

interface Props {
  visible: boolean;
  value: string; // "HH:mm"(24시간)
  onClose: () => void;
  onConfirm: (time: string) => void; // "HH:mm"(24시간)
}

// 오전/오후+시(1~12)+분 3열 휠 — 각 열은 한 줄씩 스냅 스크롤. Figma 실측(691:12580 "일정
// 만들기-시간선택", 채널 3ussd0cc, 2026-09-09): 한 줄 높이 56, 가운데 선택 줄만 검정 SemiBold20,
// 나머지는 회색(#999999) Regular20 — 실측은 바로 위/아래 줄만 보여줬지만 그 바깥 줄도 같은 회색으로
// 통일해 단순화함
const ROW_HEIGHT = 56;
const PADDING_ROWS = 1; // 위아래 여백(첫/마지막 항목도 가운데로 스크롤될 수 있게)
// 선택 줄 위아래 구분선 너비 — Figma "Frame 575"(691:11756) 실측 202를 그대로 쓰면 우리 휠
// 컬럼(64+56+56+gap)의 실제 렌더 폭보다 좁아서 숫자가 선 밖으로 살짝 나가길래, 우리 레이아웃
// 실측 폭에 맞춰 조금 넓힘(2026-09-12)
const SELECTION_LINE_WIDTH = 224;
const WHEEL_HEIGHT = ROW_HEIGHT * 3;

const AMPM_LABELS = ['오전', '오후'];
const HOUR_LABELS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTE_LABELS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function to12Hour(hour24: number) {
  const isPM = hour24 >= 12;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { ampmIndex: isPM ? 1 : 0, hourIndex: hour12 - 1 };
}

function to24Hour(ampmIndex: number, hourIndex: number) {
  let hour24 = hourIndex + 1;
  if (ampmIndex === 1) {
    if (hour24 !== 12) hour24 += 12;
  } else if (hour24 === 12) {
    hour24 = 0;
  }
  return hour24;
}

// Figma "시간 선택" 바텀시트 그대로 — CalendarPicker.tsx와 같은 Modal(slide)+반투명 배경(0.5, 실측
// 값 그대로 — 나머지 앱은 0.4를 관례로 쓰지만 이 프레임은 0.5로 별도 실측됨) 패턴 재사용
export function TimePicker({ visible, value, onClose, onConfirm }: Props) {
  const [ampmIndex, setAmpmIndex] = useState(0);
  const [hourIndex, setHourIndex] = useState(0);
  const [minute, setMinute] = useState(0);

  // Modal은 visible=false여도 JS 트리는 계속 마운트돼있어서(react-native 공통 동작), useRef로 이
  // 값들을 들고 있으면 최초 마운트 시점(시작/종료시간 어느 쪽도 아직 안 고른 시점, value가 엉뚱한
  // 기본값)에 딱 한 번만 계산되고 이후로 절대 안 바뀌는 버그가 있었음(2026-09-09 실기기 확인 —
  // 시(hour)는 스크롤한 대로 반영되는데 오전/오후는 항상 처음 계산값 그대로 붙어서 나옴). 열릴
  // 때마다(visible=true로 바뀔 때) value 기준으로 다시 계산하도록 state+useEffect로 교체
  useEffect(() => {
    if (!visible) return;
    const [hh, mm] = value.split(':').map(Number);
    const initial = to12Hour(hh);
    setAmpmIndex(initial.ampmIndex);
    setHourIndex(initial.hourIndex);
    setMinute(mm);
  }, [visible, value]);

  function handleConfirm() {
    const hour24 = to24Hour(ampmIndex, hourIndex);
    onConfirm(`${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  }

  // 휠 3개 다 key={visible}로 열릴 때마다 새로 마운트되게 함 — 그래야 각 ScrollView의 초기 스크롤
  // 위치(contentOffset)와 내부 표시 상태가 위 useEffect로 갱신된 최신 값을 반영함. visible이
  // false->true로 바뀔 때마다 key도 항상 직전과 달라지므로(문자열 "false"->"true") 매번 확실히
  // 리마운트됨
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>시간 선택</Text>

          <View style={styles.wheelArea}>
            <View style={styles.selectionLineTop} pointerEvents="none" />
            <View style={styles.selectionLineBottom} pointerEvents="none" />
            <View style={styles.wheelRow}>
              <WheelColumn
                key={`ampm-${visible}`}
                items={AMPM_LABELS}
                initialIndex={ampmIndex}
                width={64}
                onSelect={setAmpmIndex}
              />
              <WheelColumn
                key={`hour-${visible}`}
                items={HOUR_LABELS}
                initialIndex={hourIndex}
                width={56}
                onSelect={setHourIndex}
              />
              <Text style={styles.colon}>:</Text>
              <WheelColumn
                key={`minute-${visible}`}
                items={MINUTE_LABELS}
                initialIndex={minute}
                width={56}
                onSelect={setMinute}
              />
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Text style={styles.confirmText}>선택</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function WheelColumn({
  items,
  initialIndex,
  width,
  onSelect,
}: {
  items: string[];
  initialIndex: number;
  width: number;
  onSelect: (index: number) => void;
}) {
  // 굵게 표시되는 "선택된 줄"이 스크롤 도중엔 안 바뀌고 손 뗄 때(momentum 끝)만 갱신되면 어색해서
  // 로컬 state로 따로 들고 있음 — 드래그만 하고 momentum 없이 멈추는 경우까지 커버하려고
  // onScrollEndDrag에서도 같이 갱신(2026-09-09)
  const [current, setCurrent] = useState(initialIndex);

  function handleSettle(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = clamp(Math.round(e.nativeEvent.contentOffset.y / ROW_HEIGHT), 0, items.length - 1);
    setCurrent(index);
    onSelect(index);
  }

  return (
    <ScrollView
      style={{ width, height: WHEEL_HEIGHT }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ROW_HEIGHT}
      decelerationRate="fast"
      contentContainerStyle={{ paddingVertical: ROW_HEIGHT * PADDING_ROWS }}
      contentOffset={{ x: 0, y: initialIndex * ROW_HEIGHT }}
      onMomentumScrollEnd={handleSettle}
      onScrollEndDrag={handleSettle}
    >
      {items.map((label, i) => (
        <View key={label} style={styles.wheelItem}>
          <Text style={[styles.wheelText, i === current && styles.wheelTextSelected]}>{label}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17,17,17,0.5)', justifyContent: 'center', alignItems: 'center' },
  sheet: {
    width: 320,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  title: { fontFamily: fonts.semiBold, fontSize: 20, color: colors.black, marginBottom: 20 },
  wheelArea: { height: WHEEL_HEIGHT, justifyContent: 'center' },
  // 선택 줄을 사각 박스로 감싸던 걸(선택된 줄이 각지고 눈에 튀어 Figma "일정 만들기-시간선택"
  // 실측과 다르다는 지적, 2026-09-12) 위아래 구분선 2개로 교체 — Figma엔 테두리 박스가 아니라
  // 선택 줄 경계에 얇은 선(#e5e5ec)만 있음. 폭은 가운데 정렬(left:50%+음수 marginLeft)로 고정폭만
  // 딱 차지하게 함(왼쪽 전체를 다 채우면 실측보다 훨씬 헐렁해 보임)
  selectionLineTop: {
    position: 'absolute',
    left: '50%',
    marginLeft: -SELECTION_LINE_WIDTH / 2,
    width: SELECTION_LINE_WIDTH,
    top: ROW_HEIGHT,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  selectionLineBottom: {
    position: 'absolute',
    left: '50%',
    marginLeft: -SELECTION_LINE_WIDTH / 2,
    width: SELECTION_LINE_WIDTH,
    top: ROW_HEIGHT * 2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  wheelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  colon: { fontFamily: fonts.bold, fontSize: 20, color: colors.black },
  wheelItem: { height: ROW_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  wheelText: { fontFamily: fonts.regular, fontSize: 20, color: colors.gray400 },
  wheelTextSelected: { fontFamily: fonts.semiBold, color: colors.black },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 24 },
  cancelButton: {
    flex: 1,
    height: 56,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.gray400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontFamily: fonts.medium, fontSize: 16, color: colors.gray500 },
  confirmButton: {
    flex: 1,
    height: 56,
    borderRadius: 4,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { fontFamily: fonts.medium, fontSize: 16, color: colors.white },
});
