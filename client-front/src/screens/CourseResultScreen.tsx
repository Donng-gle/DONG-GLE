import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CourseCandidate, CoursePlaceRequest, courseApi } from '../api/course';
import { SwipeTransport } from '../api/swipe';

interface Props {
  sessionId: string;
  travelDate: string;
  transport: SwipeTransport;
  onSaved: () => void;
  onCancel: () => void;
}

export function CourseResultScreen({ sessionId, travelDate, transport, onSaved, onCancel }: Props) {
  const [candidate, setCandidate] = useState<CourseCandidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    setLoading(true);
    try {
      // 세션 만료(24시간 초과) 시 410 — apiClient가 ApiError로 던짐, 아래 catch에서 메시지 그대로 노출
      const response = await courseApi.generate({ session_id: sessionId, travel_date: travelDate, transport });
      // 스펙상 최대 3개지만 course_optimizer 한계로 지금은 항상 1개 (decision-log 2026-08-30 참고)
      setCandidate(response.candidates[0] ?? null);
    } catch (e) {
      Alert.alert('코스 생성에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!candidate) return;
    setSaving(true);
    try {
      const places: CoursePlaceRequest[] = candidate.places.map((place) => ({
        place_id: place.place_id,
        visit_order: place.visit_order,
        planned_time: place.planned_time,
      }));
      await courseApi.save({
        candidate_id: candidate.candidate_id,
        title: candidate.title,
        travel_date: travelDate,
        transport,
        source: 'ai',
        places,
      });
      Alert.alert('코스가 저장됐어요', undefined, [{ text: '확인', onPress: onSaved }]);
    } catch (e) {
      Alert.alert('코스 저장에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>취향에 맞는 코스를 짜고 있어요</Text>
      </View>
    );
  }

  if (!candidate) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>코스를 만들 수 없었어요. 좋아요를 조금 더 눌러본 뒤 다시 시도해주세요.</Text>
        <Button title="돌아가기" onPress={onCancel} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{candidate.title}</Text>
      {(candidate.total_distance_km != null || candidate.total_duration_min != null) && (
        <Text style={styles.summary}>
          {candidate.total_distance_km != null ? `총 ${candidate.total_distance_km.toFixed(1)}km` : ''}
          {candidate.total_distance_km != null && candidate.total_duration_min != null ? ' · ' : ''}
          {candidate.total_duration_min != null ? `약 ${candidate.total_duration_min}분` : ''}
        </Text>
      )}

      {candidate.places.map((place) => (
        <View key={place.place_id} style={styles.placeRow}>
          <Text style={styles.placeOrder}>{place.visit_order}</Text>
          <View style={styles.placeInfo}>
            <Text style={styles.placeName}>{place.name}</Text>
            {place.duration_from_prev_min != null && (
              <Text style={styles.placeMeta}>이전 장소에서 약 {place.duration_from_prev_min}분</Text>
            )}
          </View>
        </View>
      ))}

      <View style={styles.actions}>
        <Button title={saving ? '저장 중...' : '이 코스 저장하기'} onPress={handleSave} disabled={saving} />
        <View style={styles.gap} />
        <Button title="취소" onPress={onCancel} disabled={saving} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingTop: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 24 },
  loadingText: { marginTop: 12, color: '#666', fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#666', fontSize: 14, marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  summary: { fontSize: 14, color: '#666', marginBottom: 20 },
  placeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  placeOrder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ff5a5f',
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 28,
    marginRight: 12,
  },
  placeInfo: { flex: 1 },
  placeName: { fontSize: 16, fontWeight: '600' },
  placeMeta: { fontSize: 12, color: '#999', marginTop: 2 },
  actions: { marginTop: 24, marginBottom: 40 },
  gap: { height: 12 },
});
