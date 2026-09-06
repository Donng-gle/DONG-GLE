import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

export type CalendarMode = 'single' | 'range';

interface Props {
  visible: boolean;
  // 'range'면 여러 날 선택(직접 코스 만들기 전용, 2026-09-06 추가) — 기본은 기존 그대로 단일 날짜
  mode?: CalendarMode;
  value: string; // YYYY-MM-DD. single: 선택된 날짜. range: 시작일(초기값)
  rangeEnd?: string; // range 모드 종료일(초기값)
  minDate?: string; // 이 날짜보다 이전은 선택 비활성화 (YYYY-MM-DD)
  onClose: () => void;
  onConfirm: (date: string) => void; // single 모드에서만 호출됨
  onConfirmRange?: (start: string, end: string) => void; // range 모드에서만 호출됨
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function toDateKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Figma 노드 316:4643("직접 일정 만들기-날짜 선택")/598:13849("...-날짜 선택_다중 선택") 반영.
// 2026-09-06 재검토(사용자가 시안 스크린샷 첨부하며 "두 가지 기능+디자인도 동일하게" 요청,
// decision-log 참고) — 두 가지 변경:
// 1) 선택 표시를 검정 채우기 원(2026-09-01 임시 결정, 앱 톤에 맞춰 흑백으로 바꿨던 것)에서
//    시안 그대로 파란 아웃라인(colors.accentBlue)으로 되돌림 — 텍스트도 파란색
// 2) mode="range"를 추가해 시작일~종료일 범위 선택 지원. 장소를 날짜별로 나누는 기능은 아님
//    (course.end_date는 표시/저장 전용, CourseManualBuilderScreen 참고)
export function CalendarPicker({
  visible,
  mode = 'single',
  value,
  rangeEnd,
  minDate,
  onClose,
  onConfirm,
  onConfirmRange,
}: Props) {
  const insets = useSafeAreaInsets();
  const initial = value ? new Date(value + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth()); // 0-11
  const [selected, setSelected] = useState(value);
  const [rangeStart, setRangeStart] = useState<string | null>(mode === 'range' ? value || null : null);
  const [rangeEndState, setRangeEndState] = useState<string | null>(mode === 'range' ? rangeEnd || null : null);

  const weeks = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  function goMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  function handleDayPress(dateKey: string) {
    if (mode === 'single') {
      setSelected(dateKey);
      return;
    }
    // range 모드: 시작일이 없거나 이미 시작~끝이 다 정해진 상태면 새로 시작. 시작일만 있는
    // 상태에서 그보다 이른 날을 누르면 시작일을 그 날로 당김(끝일은 아직 없음), 늦은 날을
    // 누르면 끝일로 확정 — 흔한 날짜 범위 선택기 UX 그대로
    if (!rangeStart || rangeEndState) {
      setRangeStart(dateKey);
      setRangeEndState(null);
    } else if (dateKey < rangeStart) {
      setRangeStart(dateKey);
    } else {
      setRangeEndState(dateKey);
    }
  }

  function handleConfirm() {
    if (mode === 'single') {
      if (selected) onConfirm(selected);
      return;
    }
    if (rangeStart) onConfirmRange?.(rangeStart, rangeEndState ?? rangeStart);
  }

  const confirmDisabled = mode === 'range' && !rangeStart;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(20, insets.bottom + 16) }]} onPress={() => {}}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {viewYear}년 {viewMonth + 1}월
            </Text>
            <View style={styles.headerNav}>
              <TouchableOpacity onPress={() => goMonth(-1)} hitSlop={8} style={styles.navButton}>
                <Text style={styles.navIcon}>‹</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => goMonth(1)} hitSlop={8} style={styles.navButton}>
                <Text style={styles.navIcon}>›</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label) => (
              <Text key={label} style={styles.weekdayText}>
                {label}
              </Text>
            ))}
          </View>
          <View style={styles.divider} />

          {weeks.map((week, wi) => {
            // range 표시용으로 이 주(week)에서 어떤 칸이 범위 안인지 먼저 한 번에 계산 —
            // 칸 하나만 보고는 "이 칸이 줄의 왼쪽/오른쪽 끝인지"(둥글게 처리할지)를 알 수 없어서
            const rowInRange =
              mode === 'range' && rangeStart
                ? week.map((cell) => {
                    if (!cell) return false;
                    const key = toDateKey(cell.year, cell.month, cell.day);
                    return key >= rangeStart && key <= (rangeEndState ?? rangeStart);
                  })
                : week.map(() => false);

            return (
              <View key={wi} style={styles.weekRow}>
                {week.map((cell, di) => {
                  if (!cell) return <View key={di} style={styles.dayCell} />;
                  const dateKey = toDateKey(cell.year, cell.month, cell.day);
                  const disabled = minDate != null && dateKey < minDate;
                  const isSelectedSingle = mode === 'single' && dateKey === selected;
                  const inRange = rowInRange[di];
                  const isRangeStartDay = mode === 'range' && dateKey === rangeStart;
                  const isRangeEndDay = mode === 'range' && dateKey === (rangeEndState ?? rangeStart);
                  const isSingleDayRange = isRangeStartDay && isRangeEndDay;
                  const roundLeft = di === 0 || !rowInRange[di - 1];
                  const roundRight = di === 6 || !rowInRange[di + 1];
                  const highlighted = isSelectedSingle || inRange;

                  return (
                    <TouchableOpacity
                      key={di}
                      style={styles.dayCell}
                      disabled={disabled || !cell.inCurrentMonth}
                      onPress={() => handleDayPress(dateKey)}
                    >
                      {inRange && !isSingleDayRange && (
                        <View
                          style={[
                            styles.rangeBar,
                            roundLeft && styles.rangeBarRoundLeft,
                            roundRight && styles.rangeBarRoundRight,
                          ]}
                        />
                      )}
                      <View style={[styles.dayCircle, (isSelectedSingle || isSingleDayRange) && styles.dayCircleSelected]}>
                        <Text
                          style={[
                            styles.dayText,
                            (!cell.inCurrentMonth || disabled) && styles.dayTextMuted,
                            highlighted && styles.dayTextSelected,
                          ]}
                        >
                          {cell.day}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}

          <TouchableOpacity
            style={[styles.confirmButton, confirmDisabled && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={confirmDisabled}
          >
            <Text style={styles.confirmButtonText}>선택하기</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay(); // 0=일
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  type Cell = { year: number; month: number; day: number; inCurrentMonth: boolean } | null;
  const cells: Cell[] = [];

  for (let i = 0; i < startWeekday; i++) {
    const day = prevMonthDays - startWeekday + 1 + i;
    const d = new Date(year, month - 1, day);
    cells.push({ year: d.getFullYear(), month: d.getMonth(), day, inCurrentMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ year, month, day, inCurrentMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const day = cells.length - (startWeekday + daysInMonth) + 1;
    const d = new Date(year, month + 1, day);
    cells.push({ year: d.getFullYear(), month: d.getMonth(), day, inCurrentMonth: false });
  }

  const weeks: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, backgroundColor: colors.divider, marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerTitle: { fontFamily: fonts.semiBold, fontSize: 18, letterSpacing: -0.4, color: colors.black },
  headerNav: { flexDirection: 'row', gap: 8 },
  navButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  navIcon: { fontSize: 20, color: colors.black },
  weekdayRow: { flexDirection: 'row' },
  weekdayText: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 13, color: colors.gray700 },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: 8 },
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  // 단일 선택(원) — 이전엔 검정 채우기였는데 시안대로 파란 아웃라인으로 변경(2026-09-06)
  dayCircle: { width: '80%', aspectRatio: 1, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  dayCircleSelected: { borderWidth: 1.5, borderColor: colors.accentBlue },
  // range 모드에서 시작일~종료일을 하나로 이어 보이게 하는 막대 — 칸 전체 폭을 씀(원과 달리
  // 80% 인셋 없음). 위/아래 테두리는 항상, 좌/우 테두리+둥근 모서리는 그 줄에서 범위가
  // 실제로 시작/끝나는 칸에만 줘서 여러 칸이 이어진 하나의 알약처럼 보이게 함
  rangeBar: {
    position: 'absolute',
    top: '10%',
    bottom: '10%',
    left: 0,
    right: 0,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: colors.accentBlue,
  },
  rangeBarRoundLeft: { left: '10%', borderLeftWidth: 1.5, borderTopLeftRadius: 100, borderBottomLeftRadius: 100 },
  rangeBarRoundRight: { right: '10%', borderRightWidth: 1.5, borderTopRightRadius: 100, borderBottomRightRadius: 100 },
  dayText: { fontFamily: fonts.regular, fontSize: 15, color: colors.black },
  dayTextMuted: { color: colors.border },
  dayTextSelected: { fontFamily: fonts.semiBold, color: colors.accentBlue },
  confirmButton: {
    height: 52,
    borderRadius: 8,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  confirmButtonDisabled: { opacity: 0.4 },
  confirmButtonText: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.24, color: colors.white },
});
