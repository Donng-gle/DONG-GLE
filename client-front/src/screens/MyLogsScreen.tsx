import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { VisitLogMapItem, visitLogApi } from '../api/visitLog';
import { StarRating } from '../components/StarRating';
import { LogEditScreen } from './LogEditScreen';

interface Props {
  onExit: () => void;
}

export function MyLogsScreen({ onExit }: Props) {
  const [logs, setLogs] = useState<VisitLogMapItem[] | null>(null);
  const [selected, setSelected] = useState<VisitLogMapItem | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const response = await visitLogApi.myLogs();
      setLogs(response.logs);
    } catch (e) {
      Alert.alert('기록을 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
      setLogs([]);
    }
  }

  if (selected) {
    return (
      <LogEditScreen
        log={selected}
        onSaved={() => {
          setSelected(null);
          load();
        }}
        onDeleted={() => {
          setSelected(null);
          load();
        }}
        onCancel={() => setSelected(null)}
      />
    );
  }

  if (logs === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>내 방문 기록</Text>
      <FlatList
        data={logs}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={<Text style={styles.emptyText}>아직 방문 기록이 없어요.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => setSelected(item)}>
            <Text style={styles.placeName}>{item.place_name}</Text>
            {item.rating != null && <StarRating rating={item.rating} size={13} />}
            <Text style={styles.oneLine}>{item.one_line ?? '(한줄리뷰 없음)'}</Text>
            <Text style={styles.meta}>{item.visited_at.slice(0, 10)}</Text>
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
  placeName: { fontSize: 16, fontWeight: '600' },
  oneLine: { fontSize: 13, color: '#666', marginTop: 4 },
  meta: { fontSize: 12, color: '#999', marginTop: 4 },
});
