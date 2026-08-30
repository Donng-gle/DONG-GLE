import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CourseDetail, courseApi } from '../api/course';

interface Props {
  courseId: number;
  onDeleted: () => void;
  onExit: () => void;
}

export function CourseDetailScreen({ courseId, onDeleted, onExit }: Props) {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function load() {
    try {
      setCourse(await courseApi.getDetail(courseId));
    } catch (e) {
      Alert.alert('코스를 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
      onExit();
    }
  }

  function confirmDelete() {
    Alert.alert('코스를 삭제할까요?', undefined, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: handleDelete },
    ]);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await courseApi.remove(courseId);
      onDeleted();
    } catch (e) {
      Alert.alert('삭제에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
      setDeleting(false);
    }
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
      <Text style={styles.title}>{course.title}</Text>
      <Text style={styles.meta}>{course.travel_date ?? '날짜 미정'}</Text>
      {(course.total_distance_km != null || course.total_duration_min != null) && (
        <Text style={styles.summary}>
          {course.total_distance_km != null ? `총 ${course.total_distance_km.toFixed(1)}km` : ''}
          {course.total_distance_km != null && course.total_duration_min != null ? ' · ' : ''}
          {course.total_duration_min != null ? `약 ${course.total_duration_min}분` : ''}
        </Text>
      )}

      {course.places.map((place) => (
        <View key={place.place_id} style={styles.placeRow}>
          <Text style={styles.placeOrder}>{place.visit_order}</Text>
          <Text style={styles.placeName}>{place.name}</Text>
        </View>
      ))}

      <View style={styles.actions}>
        <Button title={deleting ? '삭제 중...' : '코스 삭제'} color="#d33" onPress={confirmDelete} disabled={deleting} />
        <View style={styles.gap} />
        <Button title="닫기" onPress={onExit} disabled={deleting} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingTop: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  meta: { fontSize: 13, color: '#999', marginBottom: 8 },
  summary: { fontSize: 14, color: '#666', marginBottom: 20 },
  placeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  placeOrder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ff5a5f',
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: 12,
  },
  placeName: { fontSize: 15, fontWeight: '600' },
  actions: { marginTop: 24, marginBottom: 40 },
  gap: { height: 12 },
});
