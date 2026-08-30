import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PlaceDetail, placeApi } from '../api/place';
import { PlaceLogsResponse, visitLogApi } from '../api/visitLog';
import { VisitLogCreateScreen } from './VisitLogCreateScreen';

interface Props {
  placeId: number;
  onExit: () => void;
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function formatHours(hours: PlaceDetail['hours']) {
  return hours.map((h) => {
    const open = `${WEEKDAY_LABELS[h.open_day]} ${h.open_time.slice(0, 5)}`;
    if (h.close_time == null) return `${open} ~ 24시간`;
    const closeDayLabel = h.close_day != null && h.close_day !== h.open_day ? `${WEEKDAY_LABELS[h.close_day]} ` : '';
    return `${open} ~ ${closeDayLabel}${h.close_time.slice(0, 5)}`;
  });
}

export function PlaceDetailScreen({ placeId, onExit }: Props) {
  const [place, setPlace] = useState<PlaceDetail | null>(null);
  const [logs, setLogs] = useState<PlaceLogsResponse | null>(null);
  const [likeBusy, setLikeBusy] = useState(false);
  const [showCreateLog, setShowCreateLog] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId]);

  async function load() {
    try {
      const [placeResult, logsResult] = await Promise.all([
        placeApi.getDetail(placeId),
        visitLogApi.logsForPlace(placeId),
      ]);
      setPlace(placeResult);
      setLogs(logsResult);
    } catch (e) {
      Alert.alert('장소 정보를 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
      onExit();
    }
  }

  async function toggleLike() {
    if (!place || likeBusy) return;
    setLikeBusy(true);
    try {
      const result = place.is_liked ? await placeApi.unlike(place.id) : await placeApi.like(place.id);
      setPlace({ ...place, is_liked: result.is_liked });
    } catch (e) {
      Alert.alert('찜 처리에 실패했어요', e instanceof Error ? e.message : '로그인이 필요할 수 있어요.');
    } finally {
      setLikeBusy(false);
    }
  }

  if (showCreateLog && place) {
    return (
      <VisitLogCreateScreen
        placeId={place.id}
        placeName={place.name}
        onDone={() => {
          setShowCreateLog(false);
          load();
        }}
        onCancel={() => setShowCreateLog(false)}
      />
    );
  }

  if (!place) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {place.main_image_url ? (
        <Image source={{ uri: place.main_image_url }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]} />
      )}

      <Text style={styles.name}>{place.name}</Text>
      <Text style={styles.category}>
        {place.category}
        {place.addr1 ? ` · ${place.addr1}` : ''}
      </Text>
      {place.top_tags.length > 0 && <Text style={styles.tags}>{place.top_tags.join(' · ')}</Text>}
      {place.tel && <Text style={styles.meta}>☎ {place.tel}</Text>}
      <Text style={styles.meta}>방문 기록 {place.visit_log_count}건</Text>

      {place.overview && <Text style={styles.overview}>{place.overview}</Text>}

      {place.hours.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>영업시간</Text>
          {formatHours(place.hours).map((line, idx) => (
            <Text key={idx} style={styles.hoursLine}>
              {line}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <Button
          title={likeBusy ? '처리 중...' : place.is_liked ? '찜 해제' : '찜하기'}
          onPress={toggleLike}
          disabled={likeBusy}
        />
        <View style={styles.gap} />
        <Button title="방문 기록 남기기" onPress={() => setShowCreateLog(true)} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>방문 기록 {logs ? `(${logs.meta.total})` : ''}</Text>
        {logs && logs.logs.length === 0 && <Text style={styles.emptyText}>아직 방문 기록이 없어요.</Text>}
        {logs?.logs.map((log) => (
          <View key={log.id} style={styles.logRow}>
            <Text style={styles.logOneLine}>{log.one_line ?? '(한줄리뷰 없음)'}</Text>
            <Text style={styles.logMeta}>{log.visited_at.slice(0, 10)}</Text>
          </View>
        ))}
      </View>

      <Button title="닫기" onPress={onExit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingTop: 32, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  image: { width: '100%', height: 200, borderRadius: 12 },
  imagePlaceholder: { backgroundColor: '#eee' },
  name: { fontSize: 22, fontWeight: '700', marginTop: 16 },
  category: { fontSize: 13, color: '#666', marginTop: 4 },
  tags: { fontSize: 13, color: '#ff5a5f', marginTop: 4 },
  meta: { fontSize: 13, color: '#999', marginTop: 4 },
  overview: { fontSize: 14, color: '#333', marginTop: 16, lineHeight: 20 },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  hoursLine: { fontSize: 13, color: '#666', marginBottom: 2 },
  actions: { flexDirection: 'row', marginTop: 24, gap: 12 },
  gap: { width: 12 },
  emptyText: { fontSize: 13, color: '#999' },
  logRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f1f1' },
  logOneLine: { fontSize: 14 },
  logMeta: { fontSize: 12, color: '#999', marginTop: 2 },
});
