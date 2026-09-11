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
const WHEEL_HEIGHT = ROW_HEIGHT * 3;
// 각 열(오전/오후, 시, 분) 너비/간격 — Figma 실측(691:11756 "Frame 575" 그룹, 691:12580 프레임
// 채널 nf53k2di, 2026-09-12 재실측). 이전엔 "프레임이 360 기준이라 시트 폭 320에 맞게 0.889배
// 스케일해야 한다"고 보고 모든 값을 줄였었는데, 실측해보니 Figma의 시간선택 카드 자체가 이미
// 프레임(360) 안에서 좌우 20px 여백을 두고 320폭으로 그려져 있어서(다른 폼 요소들의 입력창 폭
// 320과 동일) 우리 시트 폭 320과 정확히 1:1로 맞음 — 스케일 없이 실측값 그대로 써야 함(행/버튼
// 높이 56이 스케일 없이도 이미 들어맞는 게 그 증거). "오전/오후" 열은 실측 38, 시/분 열은
// 실측 37~39라 40으로 통일(2글자 숫자가 줄바꿈되지 않을 여유만 확보)
const AMPM_COL_WIDTH = 38;
const HOUR_COL_WIDTH = 40;
const MINUTE_COL_WIDTH = 40;
// Frame 575 내부 실측: 오전/오후 열과 시 열 사이는 24px로 넓게 벌어져 있고, 시-콜론-분 사이는
// 7~9px로 훨씬 촘촘함 — 균일한 gap 하나로는 이 비대칭을 표현할 수 없어서, 시/콜론/분 사이엔
// 아래 COL_GAP을, 오전·오후 열 오른쪽에만 AMPM_EXTRA_GAP을 더 얹어 24px를 맞춤
const COL_GAP = 8;
const AMPM_EXTRA_GAP = 16; // COL_GAP(8) + 16 = 24
// 선택 줄 위아래 구분선이 실제 렌더된 휠 폭(위 컬럼 값이 바뀌면 같이 바뀜)보다 안쪽으로 너무
// 붙거나 밖으로 삐져나오지 않게, 하드코딩 대신 wheelRow의 실측 레이아웃 폭 + 여백만큼만 쓰도록
// onLayout으로 매번 재계산함(2026-09-12, 폭을 손으로 추정하다 두 번 어긋난 뒤 결정)
const SELECTION_LINE_PADDING = 20; // 양쪽 각각

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
  // wheelRow(오전/시/:/분 한 줄)의 실제 렌더 폭 — 위아래 구분선을 이 폭 기준으로 그려서 항상
  // 내용물을 딱 맞게 감싸게 함(폭을 숫자로 하드코딩하면 폰트/자간 차이로 계속 어긋났음)
  const [rowWidth, setRowWidth] = useState(0);

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
  const lineWidth = rowWidth + SELECTION_LINE_PADDING * 2;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>시간 선택</Text>

          <View style={styles.wheelArea}>
            {rowWidth > 0 && (
              <>
                <View
                  style={[
                    styles.selectionLine,
                    { top: ROW_HEIGHT, width: lineWidth, marginLeft: -lineWidth / 2 },
                  ]}
                  pointerEvents="none"
                />
                <View
                  style={[
                    styles.selectionLine,
                    { top: ROW_HEIGHT * 2, width: lineWidth, marginLeft: -lineWidth / 2 },
                  ]}
                  pointerEvents="none"
                />
              </>
            )}
            <View style={styles.wheelRow} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
              <WheelColumn
                key={`ampm-${visible}`}
                items={AMPM_LABELS}
                initialIndex={ampmIndex}
                width={AMPM_COL_WIDTH}
                style={{ marginRight: AMPM_EXTRA_GAP }}
                onSelect={setAmpmIndex}
              />
              <WheelColumn
                key={`hour-${visible}`}
                items={HOUR_LABELS}
                initialIndex={hourIndex}
                width={HOUR_COL_WIDTH}
                onSelect={setHourIndex}
              />
              <Text style={styles.colon}>:</Text>
              <WheelColumn
                key={`minute-${visible}`}
                items={MINUTE_LABELS}
                initialIndex={minute}
                width={MINUTE_COL_WIDTH}
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
  style,
  onSelect,
}: {
  items: string[];
  initialIndex: number;
  width: number;
  style?: { marginRight?: number };
  onSelect: (index: number) => void;
}) {
  // 굵게 표시되는 "선택된 줄"이 스크롤 도중엔 안 바뀌고 손 뗄 때(momentum 끝)만 갱신되면 어색해서
  // 로컬 state로 따로 들고 있음 — 드래그만 하고 momentum 없이 멈추는 경우까지 커버하려고
  // onScrollEndDrag에서도 같이 갱신(2026-09-09)
  const [current, setCurrent] = useState(initialIndex);

  // key={`ampm-${visible}`} 덕에 모달을 껐다 켤 때마다 리마운트는 되지만, 리마운트와 "value 기준으로
  // ampmIndex/hourIndex/minute를 다시 계산하는" 상위 useEffect가 서로 다른 렌더 타이밍에 커밋되면
  // (리마운트가 먼저, 재계산이 그다음 렌더에 반영) initialIndex prop만 나중에 갱신되고 useState의
  // 초기값은 이미 고정된 뒤라 current가 갱신 전 값으로 남는 경우가 있었음 — 실기기에서 "선택된 줄
  // 위치는 맞는데 굵게 표시가 안 됨"으로 확인(2026-09-12, 사용자 리포트). initialIndex가 바뀔 때마다
  // current를 명시적으로 맞춰서 스크롤 위치와 굵게 표시가 항상 같이 가게 함
  useEffect(() => {
    setCurrent(initialIndex);
  }, [initialIndex]);

  function handleSettle(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = clamp(Math.round(e.nativeEvent.contentOffset.y / ROW_HEIGHT), 0, items.length - 1);
    setCurrent(index);
    onSelect(index);
  }

  return (
    <ScrollView
      // ScrollView는 RN에서 기본적으로 flexGrow:1이 걸려있어서 width를 줘도 wheelRow(부모, flex row)
      // 안 남는 공간을 계속 채우려고 늘어남 — 실측 로그로 확인(2026-09-12, 채널 nf53k2di 대조):
      // width:38/40 선언에도 실제 렌더 폭이 79~82로 거의 2배였고, 그래서 rowWidth(구분선 길이 계산에
      // 쓰는 값)도 wheelArea 전체 폭(288)까지 부풀어서 구분선이 카드 밖으로 삐져나왔었음
      // (사용자가 스크린샷으로 지적). flexGrow/flexShrink를 0으로 고정해 선언한 width 그대로 렌더되게 함
      style={{ width, height: WHEEL_HEIGHT, flexGrow: 0, flexShrink: 0, ...style }}
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
  // Figma 실측: 제목 텍스트 아래~첫 번째 휠 줄 사이 22px(스케일 없이 그대로)
  title: { fontFamily: fonts.semiBold, fontSize: 20, color: colors.black, marginBottom: 22 },
  // alignItems 기본값(stretch) 때문에 wheelRow가 내용 폭이 아니라 wheelArea 전체 폭(288)으로
  // 늘어나 있었음 — 그 늘어난 폭을 onLayout으로 재서 구분선 폭 계산에 썼더니 선이 시트 폭(320)
  // 보다도 넓게 그려져 카드 밖으로 삐져나왔음(사용자가 스크린샷으로 지적, 2026-09-12). wheelRow가
  // 제 내용 폭만큼만 차지하게 alignItems:'center'로 명시
  wheelArea: { height: WHEEL_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  // 선택 줄을 사각 박스로 감싸던 걸(선택된 줄이 각지고 눈에 튀어 Figma "일정 만들기-시간선택"
  // 실측과 다르다는 지적, 2026-09-12) 위아래 구분선 2개로 교체 — Figma엔 테두리 박스가 아니라
  // 선택 줄 경계에 얇은 선(#e5e5ec)만 있음. width/marginLeft는 실제 렌더 폭 기준으로 매번
  // 인라인으로 채워짐(위 lineWidth 참고) — 폭을 여기서 고정값으로 박아두면 폰트 렌더링에 따라
  // 다시 어긋날 수 있어서 여기선 좌표축만 잡음
  selectionLine: {
    position: 'absolute',
    left: '50%',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  wheelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: COL_GAP },
  colon: { fontFamily: fonts.bold, fontSize: 20, color: colors.black },
  wheelItem: { height: ROW_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  wheelText: { fontFamily: fonts.regular, fontSize: 20, color: colors.gray400 },
  wheelTextSelected: { fontFamily: fonts.semiBold, color: colors.black },
  // Figma 실측: 마지막 줄~버튼 간격 40px(스케일 없이 그대로, 기존에 0.889 스케일해 36으로 뒀던 게
  // 오차 원인이었음). 버튼 사이 간격도 실측 4px로 촘촘함(기존 8은 임의값). 버튼 영역 자체는
  // Group 570 실측폭 300(시트 320 기준 좌우 10px 여백)이라, sheet의 paddingHorizontal(16)보다
  // 6px씩 더 밖으로 빼야 해서 marginHorizontal:-6
  buttonRow: { flexDirection: 'row', gap: 4, marginTop: 40, marginHorizontal: -6 },
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
