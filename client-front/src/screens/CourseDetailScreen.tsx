import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CourseDetail, courseApi } from '../api/course';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

interface Props {
  courseId: number;
  onEdit: () => void;
  onDeleted: () => void;
  onExit: () => void;
}

const ANDONG_REGION = { latitude: 36.5684, longitude: 128.7294, latitudeDelta: 0.1, longitudeDelta: 0.1 };

// Figma엔 이 화면(저장된 코스 조회) 전용 시안이 없어서(437:4426은 Lorem ipsum 등 템플릿 잔재가
// 섞여있어 배제하기로 함, decision-log 2026-09-03 참고) 번호 핀 지도+Day 리스트 구성이 이미 확립된
// CourseResultScreen(Figma 510:11285 "AI 일정 만들기-화면" 반영분)의 지도/리스트 부분을 그대로 재사용함
export function CourseDetailScreen({ courseId, onEdit, onDeleted, onExit }: Props) {
  const insets = useSafeAreaInsets();
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
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={colors.black} />
      </View>
    );
  }

  const pinnedPlaces = course.places.filter((p) => p.lat != null && p.lng != null);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onExit} hitSlop={8} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {course.title}
        </Text>
        <TouchableOpacity onPress={onEdit} hitSlop={8} style={styles.backButton} disabled={deleting}>
          <Text style={styles.editText}>수정</Text>
        </TouchableOpacity>
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

        <View style={styles.summaryRow}>
          <Text style={styles.meta}>{course.travel_date ?? '날짜 미정'}</Text>
          {(course.total_distance_km != null || course.total_duration_min != null) && (
            <Text style={styles.summary}>
              {course.total_distance_km != null ? `총 ${course.total_distance_km.toFixed(1)}km` : ''}
              {course.total_distance_km != null && course.total_duration_min != null ? ' · ' : ''}
              {course.total_duration_min != null ? `약 ${course.total_duration_min}분` : ''}
            </Text>
          )}
        </View>

        <View style={styles.placeList}>
          {course.places.map((place, idx) => (
            <View key={place.place_id} style={styles.placeRow}>
              <View style={styles.placeRowLeft}>
                <View style={styles.orderBadge}>
                  <Text style={styles.orderBadgeText}>{place.visit_order}</Text>
                </View>
                {idx < course.places.length - 1 && <View style={styles.connectingLine} />}
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

        <TouchableOpacity onPress={confirmDelete} disabled={deleting} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>{deleting ? '삭제 중...' : '코스 삭제'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 8 },
  backButton: { width: 44, height: 32, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 20, color: colors.black },
  editText: { fontFamily: fonts.medium, fontSize: 14, color: colors.black },
  headerTitle: { flex: 1, fontFamily: fonts.semiBold, fontSize: 17, letterSpacing: -0.4, color: colors.black, textAlign: 'center' },
  content: { paddingBottom: 40 },
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
  summaryRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 16, gap: 8 },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.gray500 },
  summary: { fontFamily: fonts.medium, fontSize: 14, color: colors.gray700 },
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
  deleteButton: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 20, marginTop: 12 },
  deleteButtonText: { fontFamily: fonts.medium, fontSize: 14, color: colors.danger },
});
