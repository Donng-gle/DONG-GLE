import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CourseManualRequest, courseApi } from '../api/course';
import { PlaceListItem } from '../api/place';
import { SwipeTransport } from '../api/swipe';
import { CalendarPicker } from '../components/CalendarPicker';
import { CourseBuilderPlaceList } from '../components/CourseBuilderPlaceList';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { PlaceListScreen } from './PlaceListScreen';

interface Props {
  onSaved: () => void;
  onExit: () => void;
}

type Step = 'form' | 'picking';

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

// decision-log 2026-07-17: 코스 생성 진입점 2가지(AI 코스 / 직접 코스) 중 직접 코스 쪽.
// POST /courses/manual — course_optimizer를 거치지 않고 사용자가 장소·순서를 직접 정해서 저장
export function CourseManualBuilderScreen({ onSaved, onExit }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('form');
  const [title, setTitle] = useState('');
  const [travelDate, setTravelDate] = useState(TODAY);
  const [transport, setTransport] = useState<SwipeTransport>('walk');
  const [showCalendar, setShowCalendar] = useState(false);
  const [places, setPlaces] = useState<PlaceListItem[]>([]);
  const [saving, setSaving] = useState(false);

  function addPlace(place: PlaceListItem) {
    if (places.some((p) => p.id === place.id)) {
      Alert.alert('이미 추가된 장소예요');
      return;
    }
    setPlaces([...places, place]);
    setStep('form');
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...places];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setPlaces(next);
  }

  function moveDown(index: number) {
    if (index === places.length - 1) return;
    const next = [...places];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setPlaces(next);
  }

  function remove(index: number) {
    setPlaces(places.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert('코스 제목을 입력해주세요');
      return;
    }
    if (places.length === 0) {
      Alert.alert('장소를 1곳 이상 추가해주세요');
      return;
    }

    setSaving(true);
    try {
      const request: CourseManualRequest = {
        title: title.trim(),
        travel_date: travelDate,
        transport,
        places: places.map((place, index) => ({ place_id: place.id, visit_order: index + 1 })),
      };
      await courseApi.saveManual(request);
      Alert.alert('코스가 저장됐어요', undefined, [{ text: '확인', onPress: onSaved }]);
    } catch (e) {
      Alert.alert('저장에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setSaving(false);
    }
  }

  if (step === 'picking') {
    return <PlaceListScreen onExit={() => setStep('form')} onSelectPlace={addPlace} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onExit} hitSlop={8} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>직접 코스 만들기</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>코스 제목</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="안동 하루 코스"
          placeholderTextColor={colors.gray500}
        />

        <Text style={[styles.label, styles.labelSpaced]}>여행 날짜</Text>
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

        <View style={styles.placesSection}>
          <Text style={[styles.label, styles.labelSpaced]}>장소 ({places.length}곳)</Text>
          <CourseBuilderPlaceList
            items={places.map((p) => ({ placeId: p.id, name: p.name }))}
            onMoveUp={moveUp}
            onMoveDown={moveDown}
            onRemove={remove}
          />
          <TouchableOpacity style={styles.addPlaceButton} onPress={() => setStep('picking')}>
            <Text style={styles.addPlaceButtonText}>장소 추가</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: Math.max(20, insets.bottom + 16) }]}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>코스 저장</Text>}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 8 },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 20, color: colors.black },
  headerTitle: { fontFamily: fonts.semiBold, fontSize: 17, letterSpacing: -0.4, color: colors.black },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  label: { fontFamily: fonts.medium, fontSize: 14, letterSpacing: -0.35, color: colors.black, marginBottom: 8 },
  labelSpaced: { marginTop: 24 },
  input: {
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.black,
  },
  fieldButton: { height: 52, borderRadius: 8, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', paddingHorizontal: 16 },
  fieldButtonText: { fontFamily: fonts.regular, fontSize: 15, color: colors.black },
  transportRow: { flexDirection: 'row', gap: 8 },
  transportOption: { flex: 1, paddingVertical: 14, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  transportOptionSelected: { backgroundColor: colors.black, borderColor: colors.black },
  transportOptionText: { fontFamily: fonts.medium, fontSize: 14, color: colors.gray700 },
  transportOptionTextSelected: { color: colors.white },
  placesSection: { marginBottom: 8 },
  addPlaceButton: { height: 44, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  addPlaceButtonText: { fontFamily: fonts.medium, fontSize: 14, color: colors.black },
  actions: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider },
  primaryButton: { height: 52, borderRadius: 8, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.24, color: colors.white },
});
