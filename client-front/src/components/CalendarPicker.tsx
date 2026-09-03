import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

interface Props {
  visible: boolean;
  value: string; // YYYY-MM-DD
  minDate?: string; // 이 날짜보다 이전은 선택 비활성화 (YYYY-MM-DD)
  onClose: () => void;
  onConfirm: (date: string) => void;
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function toDateKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Figma 노드 316:4643("직접 일정 만들기-날짜 선택")의 달력 레이아웃 반영 — 색/폰트는 원본이
// Poppins·파란 강조색이었으나 앱 전체 톤(Pretendard, 검정 강조)에 맞춰 통일함 (2026-09-01 결정)
export function CalendarPicker({ visible, value, minDate, onClose, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  const initial = value ? new Date(value + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth()); // 0-11
  const [selected, setSelected] = useState(value);

  const weeks = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  function goMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

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

          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((cell, di) => {
                if (!cell) return <View key={di} style={styles.dayCell} />;
                const dateKey = toDateKey(cell.year, cell.month, cell.day);
                const disabled = minDate != null && dateKey < minDate;
                const isSelected = dateKey === selected;
                return (
                  <TouchableOpacity
                    key={di}
                    style={styles.dayCell}
                    disabled={disabled || !cell.inCurrentMonth}
                    onPress={() => setSelected(dateKey)}
                  >
                    <View style={[styles.dayCircle, isSelected && styles.dayCircleSelected]}>
                      <Text
                        style={[
                          styles.dayText,
                          (!cell.inCurrentMonth || disabled) && styles.dayTextMuted,
                          isSelected && styles.dayTextSelected,
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          <TouchableOpacity
            style={styles.confirmButton}
            onPress={() => {
              if (selected) onConfirm(selected);
            }}
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
  dayCircle: { width: '80%', aspectRatio: 1, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  dayCircleSelected: { backgroundColor: colors.black },
  dayText: { fontFamily: fonts.regular, fontSize: 15, color: colors.black },
  dayTextMuted: { color: colors.border },
  dayTextSelected: { fontFamily: fonts.semiBold, color: colors.white },
  confirmButton: {
    height: 52,
    borderRadius: 8,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  confirmButtonText: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.24, color: colors.white },
});
