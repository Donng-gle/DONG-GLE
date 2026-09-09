import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CourseCandidate, CoursePlaceRequest, courseApi } from '../api/course';
import { SwipeTransport } from '../api/swipe';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

interface Props {
  sessionId: string;
  travelDate: string;
  transport: SwipeTransport;
  // "여행일정 등록" 화면(CourseFlowScreen)에서 받은 시작/종료 시간 — 없으면(둘 다 null) 서버가
  // 09:00~21:00으로 폴백(2026-09-09 추가, api/course.ts 참고)
  startTime?: string | null;
  endTime?: string | null;
  onSaved: () => void;
  onCancel: () => void;
}

const ANDONG_REGION = { latitude: 36.5684, longitude: 128.7294, latitudeDelta: 0.1, longitudeDelta: 0.1 };

// Figma 노드 510:11285("AI 일정 만들기-화면") 반영 — 번호 핀 지도 + Day별 장소 리스트.
// 디자인의 카드별 카테고리 라벨(예: "관광명소")은 CoursePlaceItem에 카테고리 필드가 없어서 생략,
// "장소 추가" 버튼은 이 화면(결과 확인→저장)의 책임이 아니라 CourseEditScreen 몫이라 생략함
export function CourseResultScreen({ sessionId, travelDate, transport, startTime, endTime, onSaved, onCancel }: Props) {
  const insets = useSafeAreaInsets();
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
      const response = await courseApi.generate({
        session_id: sessionId,
        travel_date: travelDate,
        transport,
        start_time: startTime,
        end_time: endTime,
      });
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
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={colors.black} />
        <Text style={styles.loadingText}>취향에 맞는 코스를 짜고 있어요</Text>
      </View>
    );
  }

  if (!candidate) {
    return (
      <View style={styles.center}>
        <StatusBar style="dark" />
        <Text style={styles.emptyText}>코스를 만들 수 없었어요. 좋아요를 조금 더 눌러본 뒤 다시 시도해주세요.</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={onCancel}>
          <Text style={styles.secondaryButtonText}>돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pinnedPlaces = candidate.places.filter((p) => p.lat != null && p.lng != null);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onCancel} hitSlop={8} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {candidate.title}
        </Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {pinnedPlaces.length > 0 && (
          <MapView provider={PROVIDER_GOOGLE} style={styles.map} initialRegion={ANDONG_REGION}>
            <Polyline
              coordinates={pinnedPlaces.map((p) => ({ latitude: p.lat as number, longitude: p.lng as number }))}
              strokeColor={colors.black}
              strokeWidth={2}
              lineDashPattern={[6, 6]}
            />
            {pinnedPlaces.map((p) => (
              <Marker key={p.place_id} coordinate={{ latitude: p.lat as number, longitude: p.lng as number }}>
                <View style={styles.pin}>
                  <Text style={styles.pinText}>{p.visit_order}</Text>
                </View>
              </Marker>
            ))}
          </MapView>
        )}

        {(candidate.total_distance_km != null || candidate.total_duration_min != null) && (
          <Text style={styles.summary}>
            {candidate.total_distance_km != null ? `총 ${candidate.total_distance_km.toFixed(1)}km` : ''}
            {candidate.total_distance_km != null && candidate.total_duration_min != null ? ' · ' : ''}
            {candidate.total_duration_min != null ? `약 ${candidate.total_duration_min}분` : ''}
          </Text>
        )}

        <View style={styles.placeList}>
          {candidate.places.map((place, idx) => (
            <View key={place.place_id} style={styles.placeRow}>
              <View style={styles.placeRowLeft}>
                <View style={styles.orderBadge}>
                  <Text style={styles.orderBadgeText}>{place.visit_order}</Text>
                </View>
                {idx < candidate.places.length - 1 && <View style={styles.connectingLine} />}
              </View>

              <View style={styles.placeCard}>
                {place.main_image_url ? (
                  <Image source={{ uri: place.main_image_url }} style={styles.placeThumbnail} resizeMode="cover" />
                ) : (
                  <View style={[styles.placeThumbnail, styles.placeThumbnailPlaceholder]} />
                )}
                <View style={styles.placeInfo}>
                  <Text style={styles.placeName}>{place.name}</Text>
                  {place.duration_from_prev_min != null && (
                    <Text style={styles.placeMeta}>
                      이전 장소에서 {place.distance_from_prev_km?.toFixed(1)}km · 약 {place.duration_from_prev_min}분
                    </Text>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: Math.max(20, insets.bottom + 16) }]}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>이 코스 저장하기</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, padding: 24 },
  loadingText: { marginTop: 12, fontFamily: fonts.regular, fontSize: 14, color: colors.gray500 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.gray700, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 8 },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 20, color: colors.black },
  headerTitle: { flex: 1, fontFamily: fonts.semiBold, fontSize: 17, letterSpacing: -0.4, color: colors.black, textAlign: 'center' },
  content: { paddingBottom: 24 },
  map: { width: '100%', height: 200 },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  pinText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.white },
  summary: { fontFamily: fonts.medium, fontSize: 14, color: colors.gray700, paddingHorizontal: 20, marginTop: 16 },
  placeList: { paddingHorizontal: 20, marginTop: 20 },
  placeRow: { flexDirection: 'row' },
  placeRowLeft: { width: 32, alignItems: 'center' },
  orderBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  orderBadgeText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.white },
  connectingLine: { flex: 1, width: 1, backgroundColor: colors.border, marginVertical: 4, minHeight: 40 },
  placeCard: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingBottom: 20, marginLeft: 12 },
  placeThumbnail: { width: 48, height: 48, borderRadius: 8, marginRight: 12 },
  placeThumbnailPlaceholder: { backgroundColor: colors.border },
  placeInfo: { flex: 1 },
  placeName: { fontFamily: fonts.medium, fontSize: 16, letterSpacing: -0.4, color: colors.black },
  placeMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray500, marginTop: 4 },
  actions: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider },
  primaryButton: { height: 52, borderRadius: 8, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.24, color: colors.white },
  secondaryButton: { height: 48, paddingHorizontal: 24, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontFamily: fonts.medium, fontSize: 15, color: colors.black },
});
