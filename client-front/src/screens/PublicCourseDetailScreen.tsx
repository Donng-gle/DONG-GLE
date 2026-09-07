import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CourseDetail, CoursePlaceItem } from '../api/course';
import { exploreApi } from '../api/explore';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

interface Props {
  courseId: number;
  onExit: () => void;
}

const ANDONG_REGION = { latitude: 36.5684, longitude: 128.7294, latitudeDelta: 0.1, longitudeDelta: 0.1 };

// "취향 맞춤 코스" 탭 "자세히 보기"(2026-09-07 결정, decision-log 참고) — 다른 사용자의 공개 코스를
// 읽기 전용으로 보여줌. CourseDetailScreen(본인 코스, 수정/삭제 가능)과 지도+장소 리스트 렌더링은
// 거의 동일하지만: (1) 수정/삭제 버튼 없음 (2) 작성자 닉네임 표시 (3) 여러 날 코스(end_date 있음)면
// 날짜별로 묶어서 보여줌 — 직접 일정 만들기 화면의 날짜 탭과 같은 정보를 인터랙티브 탭 대신
// 스크롤 목록 안 날짜 구분 헤더로 단순화(2026-09-07 결정, decision-log 참고: 이 화면은 읽기 전용이라
// 날짜별 지도 필터링까지는 필요 없다고 판단)
export function PublicCourseDetailScreen({ courseId, onExit }: Props) {
  const insets = useSafeAreaInsets();
  const [course, setCourse] = useState<CourseDetail | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function load() {
    try {
      setCourse(await exploreApi.getCourseDetail(courseId));
    } catch (e) {
      Alert.alert('코스를 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
      onExit();
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
  const dayGroups = groupByDay(course.places);

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

        <View style={styles.summaryRow}>
          <Text style={styles.meta}>
            {course.travel_date ?? '날짜 미정'}
            {course.end_date && course.end_date !== course.travel_date ? ` ~ ${course.end_date}` : ''}
          </Text>
          {(course.total_distance_km != null || course.total_duration_min != null) && (
            <Text style={styles.summary}>
              {course.total_distance_km != null ? `총 ${course.total_distance_km.toFixed(1)}km` : ''}
              {course.total_distance_km != null && course.total_duration_min != null ? ' · ' : ''}
              {course.total_duration_min != null ? `약 ${course.total_duration_min}분` : ''}
            </Text>
          )}
        </View>

        {dayGroups.map((group) => (
          <View key={group.dayLabel ?? 'all'}>
            {group.dayLabel && <Text style={styles.dayHeader}>{group.dayLabel}</Text>}
            <View style={[styles.placeList, group.dayLabel != null && styles.placeListWithHeader]}>
              {group.places.map((place, idx) => (
                <View key={place.place_id} style={styles.placeRow}>
                  <View style={styles.placeRowLeft}>
                    <View style={styles.orderBadge}>
                      <Text style={styles.orderBadgeText}>{place.visit_order}</Text>
                    </View>
                    {idx < group.places.length - 1 && <View style={styles.connectingLine} />}
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
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

interface DayGroup {
  dayLabel: string | null; // null이면 날짜 구분 없이 전체를 하나로(단일 날짜/미정 코스)
  places: CoursePlaceItem[];
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function formatDayLabel(dateKey: string) {
  const d = new Date(dateKey + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_LABELS[d.getDay()]})`;
}

// 여러 날 코스(장소마다 visit_date가 있음, 2026-09-06 결정)만 날짜별로 묶고, 그 외(단일 날짜/과거
// 데이터/AI 코스)는 CourseDetailScreen과 동일하게 전체를 하나의 목록으로 보여줌
function groupByDay(places: CoursePlaceItem[]): DayGroup[] {
  const hasVisitDates = places.some((p) => p.visit_date != null);
  if (!hasVisitDates) return [{ dayLabel: null, places }];

  const groups: DayGroup[] = [];
  places.forEach((place) => {
    const label = place.visit_date ? formatDayLabel(place.visit_date) : '날짜 미정';
    const existing = groups.find((g) => g.dayLabel === label);
    if (existing) existing.places.push(place);
    else groups.push({ dayLabel: label, places: [place] });
  });
  return groups;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 8 },
  backButton: { width: 44, height: 32, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 20, color: colors.black },
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
  dayHeader: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    letterSpacing: -0.4,
    color: colors.black,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 4,
  },
  placeList: { paddingHorizontal: 20, marginTop: 20 },
  // dayHeader가 이미 marginTop:20을 갖고 있어서 이어붙일 땐 이중 여백 생기지 않게 줄임
  placeListWithHeader: { marginTop: 4 },
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
});
