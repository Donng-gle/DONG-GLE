import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CourseDetail, CoursePlaceItem } from '../api/course';
import { exploreApi } from '../api/explore';
import { BookmarkIcon, DistanceIcon, HeartIcon, MapPinOutlineIcon, SearchIcon, WalkIcon } from '../components/icons';
import { FloatingNav } from '../components/FloatingNav';
import { MapPin } from '../components/MapPin';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { SearchScreen } from './SearchScreen';

interface Props {
  courseId: number;
  onExit: () => void;
  // FloatingNav 전달용(2026-09-10 추가) — HomeScreen이 이 화면을 전체 화면 overlay로 띄우게 되면서
  // (course-manual/CourseResultScreen과 동일 구조) 배경에 다른 FloatingNav가 없어서 직접 그려야 함
  onCreateManual: () => void;
  onCreateAI: () => void;
  onProfile: () => void;
}

const ANDONG_REGION = { latitude: 36.5684, longitude: 128.7294, latitudeDelta: 0.1, longitudeDelta: 0.1 };

// "취향 맞춤 코스" 탭 "자세히 보기"(2026-09-07 결정, decision-log 참고) — 다른 사용자의 공개 코스를
// 읽기 전용으로 보여줌.
//
// Figma 노드 510:11285("AI 일정 만들기-화면") 재실측 반영(2026-09-10, 채널 h962fplg, 사용자 확인 —
// 이 화면이 바로 그 시안의 실제 대상 화면. CourseResultScreen.tsx(AI 코스 생성 직후 화면)도 같은
// 시안을 참고해서 먼저 만들었고, 그때 검증한 헤더/핀/리스트 스타일을 여기서도 그대로 재사용함) —
// 헤더 하트/돋보기/북마크, 파란 번호 핀, "AI 추천 여행 코스" 섹션 타이틀, 리스트 좌우 여백 16 등
// CourseResultScreen과 동일하게 맞춤. 이 화면만의 차이:
// - 읽기 전용이라 제목 옆 연필(이름 수정) 없음, 저장 버튼 없음, "장소 추가" 버튼 없음(사용자 확인,
//   CourseResultScreen과 동일 판단 — 이 화면은 원래도 CourseEditScreen 책임이 아님)
// - 하단 플로팅 네비 있음 — 처음엔 탭 콘텐츠 영역 안에서 로컬 state로만 바꾸는 화면이라 HomeScreen이
//   바깥에 그리는 FloatingNav와 겹칠까봐 뺐는데, 그러면 AppHeader/탭바가 위에 그대로 남아있어서
//   "팝업"처럼 보인다는 지적(2026-09-10) — HomeScreen이 course-manual/CourseResultScreen과 동일하게
//   이 화면을 전체 화면 overlay(courseDetailId state)로 띄우도록 바꾸고, FloatingNav도 이 화면이
//   직접 그리는 걸로 정정
// - 여러 날 코스(end_date 있음)면 날짜별로 묶어서 보여줌 — 직접 일정 만들기 화면의 날짜 탭과 같은
//   정보를 인터랙티브 탭 대신 스크롤 목록 안 날짜 구분 헤더로 단순화(2026-09-07 결정, decision-log
//   참고: 이 화면은 읽기 전용이라 날짜별 지도 필터링까지는 필요 없다고 판단) — 기존 로직 유지
// - 카드별 카테고리 라벨/총 거리·시간 요약은 CourseResultScreen과 동일한 이유로 생략(데이터 없음/
//   시안에 없음). 단, 여행 날짜만큼은 시안엔 없어도 뺴면 단일 날짜 코스에서 날짜 정보가 아예
//   안 보이게 돼서(날짜 구분 헤더는 여러 날 코스에만 나옴) 제목 아래 작게 유지함(코스 삭제를 시안에
//   없어도 CourseDetailScreen이 유지한 것과 같은 판단)
export function PublicCourseDetailScreen({ courseId, onExit, onCreateManual, onCreateAI, onProfile }: Props) {
  const insets = useSafeAreaInsets();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);

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

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.headerTop, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={onExit} hitSlop={8} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerIcons}>
            {/* 하트/북마크는 대응하는 백엔드 기능이 없어서 장식만 — CourseDetailScreen/
                CourseResultScreen과 동일 판단 */}
            <View style={styles.headerIconButton}>
              <HeartIcon size={22} />
            </View>
            <TouchableOpacity onPress={() => setSearchVisible(true)} hitSlop={6} style={styles.headerIconButton}>
              <SearchIcon size={22} />
            </TouchableOpacity>
            <View style={styles.headerIconButton}>
              <BookmarkIcon size={22} />
            </View>
          </View>
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.titleText} numberOfLines={1}>
            {course.title}
          </Text>
        </View>
        {course.travel_date && (
          <Text style={styles.dateLabel}>
            {course.travel_date}
            {course.end_date && course.end_date !== course.travel_date ? ` ~ ${course.end_date}` : ''}
          </Text>
        )}

        {pinnedPlaces.length > 0 && (
          <MapView provider={PROVIDER_GOOGLE} style={styles.map} initialRegion={ANDONG_REGION}>
            {pinnedPlaces.length > 1 && (
              <Polyline
                coordinates={pinnedPlaces.map((p) => ({ latitude: p.lat as number, longitude: p.lng as number }))}
                strokeColor={colors.accentBlue}
                strokeWidth={2}
                lineDashPattern={[6, 6]}
              />
            )}
            {pinnedPlaces.map((p) => (
              <Marker key={p.place_id} coordinate={{ latitude: p.lat as number, longitude: p.lng as number }}>
                <MapPin number={p.visit_order} />
              </Marker>
            ))}
          </MapView>
        )}

        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>AI 추천 여행 코스</Text>

          {dayGroups.map((group) => (
            <View key={group.dayLabel ?? 'all'}>
              {group.dayLabel && <Text style={styles.dayHeader}>{group.dayLabel}</Text>}
              {group.places.map((place, idx) => (
                <View key={place.place_id} style={styles.placeRow}>
                  <View style={styles.placeRowLeft}>
                    <MapPinOutlineIcon size={18} />
                    {idx < group.places.length - 1 && <View style={styles.placeConnector} />}
                  </View>
                  <View style={styles.placeRowRight}>
                    <View style={styles.placeCard}>
                      {place.main_image_url ? (
                        <Image source={{ uri: place.main_image_url }} style={styles.placeThumbnail} resizeMode="cover" />
                      ) : (
                        <View style={[styles.placeThumbnail, styles.placeThumbnailPlaceholder]} />
                      )}
                      <Text style={styles.placeName} numberOfLines={1}>
                        {place.name}
                      </Text>
                    </View>
                    {place.distance_from_prev_km != null && (
                      <View style={styles.placeMetaRow}>
                        <View style={styles.placeMetaItem}>
                          <DistanceIcon size={18} />
                          <Text style={styles.placeMetaText}>{place.distance_from_prev_km.toFixed(1)} KM</Text>
                        </View>
                        {place.duration_from_prev_min != null && (
                          <View style={styles.placeMetaItem}>
                            <WalkIcon size={18} />
                            <Text style={styles.placeMetaText}>{place.duration_from_prev_min}분</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      <FloatingNav onHome={onExit} onCreateManual={onCreateManual} onCreateAI={onCreateAI} onProfile={onProfile} />

      <Modal visible={searchVisible} transparent animationType="none" onRequestClose={() => setSearchVisible(false)}>
        <SearchScreen onExit={() => setSearchVisible(false)} />
      </Modal>
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
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  scrollContent: { paddingBottom: 140 }, // 플로팅 네비에 안 가리게 여유
  // Figma 실측(510:11285): 헤더+제목이 흰 풀블리드 블록(#ffffff, 페이지 배경 #f7f7fb 위), 지도/
  // 리스트도 각각 별도 흰 블록 — CourseDetailScreen/CourseResultScreen과 같은 카드 분리 패턴
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: colors.white,
  },
  backButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 20, color: colors.black },
  headerIcons: { flexDirection: 'row', gap: 16 },
  headerIconButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.white,
  },
  titleText: { fontFamily: fonts.semiBold, fontSize: 24, letterSpacing: -0.6, color: colors.black, flexShrink: 1 },
  // 시안엔 없지만 읽기 전용 화면이라 날짜 정보가 이거 하나뿐 — 없애면 단일 날짜 코스에서 날짜가
  // 아예 안 보이게 돼서 유지함(코스 삭제를 CourseDetailScreen이 유지한 것과 같은 판단, 위 코멘트 참고)
  dateLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.gray500, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 15, backgroundColor: colors.white },
  // 지도를 위아래로 더 보이게 확대(200→260, 사용자 요청 2026-09-10). 핀 모양은 components/MapPin.tsx
  // 참고(export_node_as_image로 실제 렌더 확인 후 물방울 핀 모양으로 재현)
  map: { width: '100%', height: 260 },
  // 헤더/제목은 좌우 여백 20이지만, 지도 아래 리스트 카드는 16 — CourseResultScreen과 동일 실측값
  listSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20, backgroundColor: colors.white },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.sectionTitle, marginBottom: 12 },
  dayHeader: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.black, marginBottom: 12 },
  placeRow: { flexDirection: 'row' },
  placeRowLeft: { width: 32, alignItems: 'center' },
  placeConnector: { flex: 1, width: 1, backgroundColor: colors.border, marginVertical: 4, minHeight: 30 },
  placeRowRight: { flex: 1, paddingBottom: 16 },
  placeCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeThumbnail: { width: 48, height: 48, borderRadius: 4 },
  placeThumbnailPlaceholder: { backgroundColor: colors.border },
  placeName: { flex: 1, fontFamily: fonts.medium, fontSize: 16, letterSpacing: -0.4, color: colors.black },
  placeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  placeMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  placeMetaText: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray500 },
});
