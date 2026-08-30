import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { SimilarLogItem, exploreApi } from '../api/explore';

interface Props {
  onExit: () => void;
}

// 지도 SDK가 아직 없어서 뷰포트(bounds) 필터 없이 전체 목록으로 보여준다.
// 실제 지도 위 핀 표시는 react-native-maps 등 도입 후 붙일 수 있음.
export function ExploreScreen({ onExit }: Props) {
  const [logs, setLogs] = useState<SimilarLogItem[] | null>(null);

  useEffect(() => {
    exploreApi
      .similarLogs()
      .then((response) => setLogs(response.logs))
      .catch((e) => {
        Alert.alert('탐색 결과를 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
        setLogs([]);
      });
  }, []);

  if (logs === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>비슷한 취향 탐색</Text>
      <Text style={styles.subtitle}>내 상위 감성태그와 겹치는 다른 유저의 공개 방문 기록이에요.</Text>
      <FlatList
        data={logs}
        keyExtractor={(item) => String(item.log_id)}
        ListEmptyComponent={
          <Text style={styles.emptyText}>아직 취향이 겹치는 유저의 공개 기록이 없어요.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            {item.photo_url ? (
              <Image source={{ uri: item.photo_url }} style={styles.thumbnail} resizeMode="cover" />
            ) : (
              <View style={[styles.thumbnail, styles.thumbnailPlaceholder]} />
            )}
            <View style={styles.info}>
              <Text style={styles.placeName}>{item.place_name}</Text>
              {item.one_line && <Text style={styles.oneLine}>{item.one_line}</Text>}
              {item.tags.length > 0 && <Text style={styles.tags}>{item.tags.join(' · ')}</Text>}
            </View>
          </View>
        )}
      />
      <Button title="닫기" onPress={onExit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 13, color: '#666', marginTop: 4, marginBottom: 16 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  thumbnail: { width: 56, height: 56, borderRadius: 8, marginRight: 12 },
  thumbnailPlaceholder: { backgroundColor: '#eee' },
  info: { flex: 1 },
  placeName: { fontSize: 15, fontWeight: '600' },
  oneLine: { fontSize: 13, color: '#666', marginTop: 2 },
  tags: { fontSize: 12, color: '#ff5a5f', marginTop: 2 },
});
