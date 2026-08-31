import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CourseDetail, CourseUpdateRequest, courseApi } from '../api/course';
import { PlaceListItem } from '../api/place';
import { CourseBuilderPlaceList } from '../components/CourseBuilderPlaceList';
import { PlaceListScreen } from './PlaceListScreen';

interface Props {
  courseId: number;
  onSaved: () => void;
  onExit: () => void;
}

type Step = 'form' | 'picking';

interface EditablePlace {
  placeId: number;
  name: string;
}

export function CourseEditScreen({ courseId, onSaved, onExit }: Props) {
  const [step, setStep] = useState<Step>('form');
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [title, setTitle] = useState('');
  const [places, setPlaces] = useState<EditablePlace[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function load() {
    try {
      const detail = await courseApi.getDetail(courseId);
      setCourse(detail);
      setTitle(detail.title);
      setPlaces(detail.places.map((p) => ({ placeId: p.place_id, name: p.name })));
    } catch (e) {
      Alert.alert('코스를 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
      onExit();
    }
  }

  function addPlace(place: PlaceListItem) {
    if (places.some((p) => p.placeId === place.id)) {
      Alert.alert('이미 포함된 장소예요');
      return;
    }
    setPlaces([...places, { placeId: place.id, name: place.name }]);
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
      Alert.alert('장소를 1곳 이상 남겨주세요');
      return;
    }

    setSaving(true);
    try {
      const request: CourseUpdateRequest = {
        title: title.trim(),
        places: places.map((place, index) => ({ place_id: place.placeId, visit_order: index + 1 })),
        // AI가 생성한 코스를 사람이 손댔다는 표시. 이미 직접 만든 코스(user)는 그대로 유지
        source: course && course.source !== 'user' ? 'ai_edited' : undefined,
      };
      await courseApi.update(courseId, request);
      onSaved();
    } catch (e) {
      Alert.alert('저장에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setSaving(false);
    }
  }

  if (step === 'picking') {
    return <PlaceListScreen onExit={() => setStep('form')} onSelectPlace={addPlace} />;
  }

  if (!course) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>코스 수정</Text>

      <Text style={styles.label}>코스 제목</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} />

      <View style={styles.placesSection}>
        <Text style={styles.label}>장소 ({places.length}곳)</Text>
        <CourseBuilderPlaceList items={places} onMoveUp={moveUp} onMoveDown={moveDown} onRemove={remove} />
        <Button title="장소 추가" onPress={() => setStep('picking')} />
      </View>

      <View style={styles.actions}>
        <Button title={saving ? '저장 중...' : '저장'} onPress={handleSave} disabled={saving} />
        <View style={styles.gap} />
        <Button title="취소" onPress={onExit} disabled={saving} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingTop: 32, paddingBottom: 40 },
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
  placesSection: { marginBottom: 24 },
  actions: { marginTop: 8 },
  gap: { height: 12 },
});
