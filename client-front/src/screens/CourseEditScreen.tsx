import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CourseDetail, CourseUpdateRequest, courseApi } from '../api/course';
import { PlaceListItem } from '../api/place';
import { CourseBuilderPlaceList } from '../components/CourseBuilderPlaceList';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
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

// 이 화면도 CourseDetailScreen과 마찬가지로 전용 Figma 시안이 없어서(437:4426 배제, decision-log
// 2026-09-03 참고) 같은 "장소 순서 편집" 작업인 CourseManualBuilderScreen(Figma 반영 완료분)의
// 헤더/입력창/버튼 스타일을 그대로 따름. CourseUpdateRequest에 여행 날짜/이동수단 필드가 없어서
// (제목·장소만 수정 가능) CourseManualBuilderScreen에 있는 날짜·이동수단 선택 UI는 넣지 않음
export function CourseEditScreen({ courseId, onSaved, onExit }: Props) {
  const insets = useSafeAreaInsets();
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
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={colors.black} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onExit} hitSlop={8} style={styles.backButton} disabled={saving}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>코스 수정</Text>
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

        <View style={styles.placesSection}>
          <Text style={[styles.label, styles.labelSpaced]}>장소 ({places.length}곳)</Text>
          <CourseBuilderPlaceList items={places} onMoveUp={moveUp} onMoveDown={moveDown} onRemove={remove} />
          <TouchableOpacity style={styles.addPlaceButton} onPress={() => setStep('picking')}>
            <Text style={styles.addPlaceButtonText}>장소 추가</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: Math.max(20, insets.bottom + 16) }]}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>저장</Text>}
        </TouchableOpacity>
      </View>
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
  placesSection: { marginBottom: 8 },
  addPlaceButton: { height: 44, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  addPlaceButtonText: { fontFamily: fonts.medium, fontSize: 14, color: colors.black },
  actions: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider },
  primaryButton: { height: 52, borderRadius: 8, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.24, color: colors.white },
});
