import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { EventListItem, eventApi } from '../api/event';

interface Props {
  onExit: () => void;
}

function dDayLabel(dDay: number) {
  if (dDay < 0) return '종료';
  if (dDay === 0) return '진행 중';
  return `D-${dDay}`;
}

export function EventsScreen({ onExit }: Props) {
  const [events, setEvents] = useState<EventListItem[] | null>(null);

  useEffect(() => {
    eventApi
      .list()
      .then((response) => setEvents(response.events))
      .catch((e) => {
        Alert.alert('행사 목록을 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
        setEvents([]);
      });
  }, []);

  if (events === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>이달의 행사·축제</Text>
      <FlatList
        data={events}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={<Text style={styles.emptyText}>이번 달 행사가 없어요.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            {item.main_image_url ? (
              <Image source={{ uri: item.main_image_url }} style={styles.thumbnail} resizeMode="cover" />
            ) : (
              <View style={[styles.thumbnail, styles.thumbnailPlaceholder]} />
            )}
            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.event_start_date} ~ {item.event_end_date}
              </Text>
              {item.addr1 && <Text style={styles.meta}>{item.addr1}</Text>}
            </View>
            <Text style={styles.dDay}>{dDayLabel(item.d_day)}</Text>
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
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  thumbnail: { width: 56, height: 56, borderRadius: 8, marginRight: 12 },
  thumbnailPlaceholder: { backgroundColor: '#eee' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12, color: '#999', marginTop: 2 },
  dDay: { fontSize: 13, fontWeight: '700', color: '#ff5a5f', marginLeft: 8 },
});
