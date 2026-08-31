import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CourseListItem, courseApi } from '../api/course';
import { CourseDetailScreen } from './CourseDetailScreen';
import { CourseEditScreen } from './CourseEditScreen';

interface Props {
  onExit: () => void;
}

type Mode = 'list' | 'detail' | 'edit';

export function MyCoursesScreen({ onExit }: Props) {
  const [courses, setCourses] = useState<CourseListItem[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>('list');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const response = await courseApi.myCourses();
      setCourses(response.courses);
    } catch (e) {
      Alert.alert('코스 목록을 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
      setCourses([]);
    }
  }

  if (mode === 'edit' && selectedId != null) {
    return (
      <CourseEditScreen
        courseId={selectedId}
        onSaved={() => {
          setMode('list');
          setSelectedId(null);
          load();
        }}
        onExit={() => setMode('detail')}
      />
    );
  }

  if (mode === 'detail' && selectedId != null) {
    return (
      <CourseDetailScreen
        courseId={selectedId}
        onEdit={() => setMode('edit')}
        onDeleted={() => {
          setMode('list');
          setSelectedId(null);
          load();
        }}
        onExit={() => {
          setMode('list');
          setSelectedId(null);
        }}
      />
    );
  }

  if (courses === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>내 코스</Text>
      <FlatList
        data={courses}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={<Text style={styles.emptyText}>저장한 코스가 없어요.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              setSelectedId(item.id);
              setMode('detail');
            }}
          >
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Text style={styles.rowMeta}>
              {item.travel_date ?? '날짜 미정'} · 장소 {item.place_count}곳
            </Text>
          </TouchableOpacity>
        )}
      />
      <Button title="닫기" onPress={onExit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 40 },
  row: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowMeta: { fontSize: 13, color: '#999', marginTop: 4 },
});
