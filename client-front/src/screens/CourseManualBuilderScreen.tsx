import { useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CourseManualRequest, courseApi } from '../api/course';
import { PlaceListItem } from '../api/place';
import { SwipeTransport } from '../api/swipe';
import { CourseBuilderPlaceList } from '../components/CourseBuilderPlaceList';
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

// decision-log 2026-07-17: 코스 생성 진입점 2가지(AI 코스 / 직접 코스) 중 직접 코스 쪽.
// POST /courses/manual — course_optimizer를 거치지 않고 사용자가 장소·순서를 직접 정해서 저장
export function CourseManualBuilderScreen({ onSaved, onExit }: Props) {
  const [step, setStep] = useState<Step>('form');
  const [title, setTitle] = useState('');
  const [travelDate, setTravelDate] = useState(TODAY);
  const [transport, setTransport] = useState<SwipeTransport>('walk');
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>직접 코스 만들기</Text>

      <Text style={styles.label}>코스 제목</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="안동 하루 코스" />

      <Text style={styles.label}>여행 날짜 (YYYY-MM-DD)</Text>
      <TextInput style={styles.input} value={travelDate} onChangeText={setTravelDate} autoCapitalize="none" />

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

      <View style={styles.placesSection}>
        <Text style={styles.label}>장소 ({places.length}곳)</Text>
        <CourseBuilderPlaceList
          items={places.map((p) => ({ placeId: p.id, name: p.name }))}
          onMoveUp={moveUp}
          onMoveDown={moveDown}
          onRemove={remove}
        />
        <Button title="장소 추가" onPress={() => setStep('picking')} />
      </View>

      <View style={styles.actions}>
        <Button title={saving ? '저장 중...' : '코스 저장'} onPress={handleSave} disabled={saving} />
        <View style={styles.gap} />
        <Button title="취소" onPress={onExit} disabled={saving} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingTop: 32, paddingBottom: 40 },
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
  transportRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
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
  placesSection: { marginBottom: 24 },
  actions: { marginTop: 8 },
  gap: { height: 12 },
});
