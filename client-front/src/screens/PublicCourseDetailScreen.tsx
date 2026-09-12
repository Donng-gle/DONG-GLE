import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CourseDetail, CoursePlaceItem, CoursePlaceRequest, courseApi } from '../api/course';
import { exploreApi } from '../api/explore';
import { DistanceIcon, HeartIcon, MapPinOutlineIcon, WalkIcon } from '../components/icons';
import { FloatingNav } from '../components/FloatingNav';
import { MapPin } from '../components/MapPin';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

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
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// travel_date~end_date를 하루 단위로 나열 — CourseDetailScreen.tsx의 동명 함수와 동일 로직
function buildDateTabs(start: string, end: string | null) {
  const startDate = new Date(start + 'T00:00:00');
  const endDate = end ? new Date(end + 'T00:00:00') : startDate;
  const tabs: { dateKey: string; day: number; weekday: string }[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    tabs.push({ dateKey: toDateKey(cursor), day: cursor.getDate(), weekday: WEEKDAY_LABELS[cursor.getDay()] });
    cursor.setDate(cursor.getDate() + 1);
  }
  return tabs;
}

function formatShortDateLabel(dateKey: string) {
  const [, m, d] = dateKey.split('-').map(Number);
  const weekday = WEEKDAY_LABELS[new Date(dateKey + 'T00:00:00').getDay()];
  return `${m}/${d}(${weekday})`;
}

// "취향 맞춤 코스" 탭 "자세히 보기"(2026-09-07 결정, decision-log 참고) — 다른 사용자의 공개 코스를
// 읽기 전용으로 보여줌.
//
// Figma 노드 510:11285("AI 일정 만들기-화면") 재실측 반영(2026-09-10, 채널 h962fplg, 사용자 확인 —
// 이 화면이 바로 그 시안의 실제 대상 화면. CourseResultScreen.tsx(AI 코스 생성 직후 화면)도 같은
// 시안을 참고해서 먼저 만들었고, 그때 검증한 헤더/핀/리스트 스타일을 여기서도 그대로 재사용함) —
// 헤더 하트/돋보기/북마크, 파란 번호 핀, "AI 추천 여행 코스" 섹션 타이틀, 리스트 좌우 여백 16 등
// CourseResultScreen과 동일하게 맞춤. 이 화면만의 차이:
// - 읽기 전용이라 제목 옆 연필(이름 수정) 없음, "장소 추가" 버튼 없음(사용자 확인, CourseResultScreen과
//   동일 판단 — 이 화면은 원래도 CourseEditScreen 책임이 아님)
// - 하트(2026-09-11 추가, 사용자 확인 — 헤더 돋보기/북마크 제거하고 하트만 남김): 다른 사용자의
//   코스를 "좋아요"하면 내 스크랩북으로 복제 저장됨. 전용 "복제" API는 없지만 courseApi.save(POST
//   /courses)가 candidate_id 없이 title/places만으로도 저장되길래(CourseSaveRequest 참고) 그대로
//   재사용 — 새 코스로 insert되니 원본 작성자에는 영향 없음. transport는 CourseDetail에 없어서
//   null(조회 시 서버가 walk로 기본 계산, api/course.ts 참고), source는 전용 값 'liked'(백엔드
//   2026-09-11 추가 — 'user'로 저장하면 직접 만든 코스와 안 구분돼서 ScrapbookScreen의 "나의 코스"/
//   "여행코스" 탭 분리가 안 됨)
// - 하단 플로팅 네비 있음 — 처음엔 탭 콘텐츠 영역 안에서 로컬 state로만 바꾸는 화면이라 HomeScreen이
//   바깥에 그리는 FloatingNav와 겹칠까봐 뺐는데, 그러면 AppHeader/탭바가 위에 그대로 남아있어서
//   "팝업"처럼 보인다는 지적(2026-09-10) — HomeScreen이 course-manual/CourseResultScreen과 동일하게
//   이 화면을 전체 화면 overlay(courseDetailId state)로 띄우도록 바꾸고, FloatingNav도 이 화면이
//   직접 그리는 걸로 정정
// - 여러 날 코스(end_date 있음)면 날짜 탭으로 하루씩 골라볼 수 있게 함(2026-09-11 변경, 사용자 확인
//   — "직접 일정 만들기-기본화면"(501:12088) 프레임처럼). 예전엔 스크롤 목록 안 날짜 구분 헤더로
//   전체를 한 번에 보여줬는데, 코스마다 실제로 며칠짜리인지 인지하기 어렵다는 지적으로 정정 —
//   CourseDetailScreen.tsx의 buildDateTabs/selectedDateTab 로직을 그대로 재사용
// - 카드별 카테고리 라벨은 실제 백엔드 필드(2026-09-11 추가)를 그대로 보여줌
export function PublicCourseDetailScreen({ courseId, onExit, onCreateManual, onCreateAI, onProfile }: Props) {
  const insets = useSafeAreaInsets();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [liking, setLiking] = useState(false);
  const [liked, setLiked] = useState(false);
  const [selectedDateTab, setSelectedDateTab] = useState('');

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function load() {
    try {
      const detail = await exploreApi.getCourseDetail(courseId);
      setCourse(detail);
      if (detail.travel_date) setSelectedDateTab(detail.travel_date);
    } catch (e) {
      Alert.alert('코스를 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
      onExit();
    }
  }

  async function handleHeartPress() {
    if (!course || liked || liking) return;
    setLiking(true);
    try {
      const places: CoursePlaceRequest[] = course.places.map((place) => ({
        place_id: place.place_id,
        visit_order: place.visit_order,
        planned_time: place.planned_time,
        visit_date: place.visit_date,
      }));
      await courseApi.save({
        title: course.title,
        travel_date: course.travel_date,
        end_date: course.end_date,
        transport: null,
        // 'user'로 저장하면 직접 만든 코스와 구분이 안 돼서(2026-09-11, 사용자 확인 — 스크랩북에
        // "나의 코스"/"여행코스" 탭 분리) 전용 source 값 사용
        source: 'liked',
        places,
      });
      setLiked(true);
      Alert.alert('내 스크랩북에 저장됐어요');
    } catch (e) {
      Alert.alert('저장에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLiking(false);
    }
  }

  const dateTabs = useMemo(
    () => (course?.travel_date ? buildDateTabs(course.travel_date, course.end_date) : []),
    [course?.travel_date, course?.end_date],
  );

  // AI 코스처럼 visit_date가 아예 없는 경우엔 필터 없이 전체를 보여줌(CourseDetailScreen과 동일 판단)
  const hasVisitDates = course?.places.some((p) => p.visit_date != null) ?? false;
  const placesForTab: CoursePlaceItem[] = !course
    ? []
    : hasVisitDates
      ? course.places.filter((p) => p.visit_date === selectedDateTab)
      : course.places;
  const pinnedPlaces = placesForTab.filter((p) => p.lat != null && p.lng != null);

  if (!course) {
    return (
      <View style={styles.center}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={colors.black} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.headerTop, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={onExit} hitSlop={8} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerIcons}>
            {/* 돋보기/북마크 제거, 하트만 남김(사용자 확인, 2026-09-11) — 눌러서 내 스크랩북으로
                복제 저장, 저장되면 채워진 하트로 표시 */}
            <TouchableOpacity onPress={handleHeartPress} hitSlop={6} disabled={liking} style={styles.headerIconButton}>
              <HeartIcon size={22} filled={liked} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.titleText} numberOfLines={1}>
            {course.title}
          </Text>
        </View>

        {dateTabs.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dateTabScroll}
            contentContainerStyle={styles.dateTabRow}
          >
            {dateTabs.map((tab) => {
              const selected = tab.dateKey === selectedDateTab;
              return (
                <TouchableOpacity
                  key={tab.dateKey}
                  style={[styles.dateTab, selected && styles.dateTabSelected]}
                  onPress={() => setSelectedDateTab(tab.dateKey)}
                >
                  <Text style={[styles.dateTabWeekday, selected && styles.dateTabTextSelected]}>{tab.weekday}</Text>
                  <Text style={[styles.dateTabDay, selected && styles.dateTabTextSelected]}>{tab.day}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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
          {/* "AI 추천 여행 코스" 섹션 타이틀 제거(2026-09-12 사용자 요청) — 이 화면은 취향 맞춤
              코스 탭의 "자세히 보기"로 다른 사용자의 공개 코스를 보는 화면이라, AI가 생성한
              코스가 아닌 경우에도 이 문구가 고정으로 붙어있는 게 부적절했음 */}
          {selectedDateTab && <Text style={styles.dayHeader}>{formatShortDateLabel(selectedDateTab)}</Text>}

          {placesForTab.map((place, index) => (
            <View key={place.place_id} style={styles.placeRow}>
              <View style={styles.placeRowLeft}>
                <MapPinOutlineIcon size={18} />
                {index < placesForTab.length - 1 && <View style={styles.placeConnector} />}
              </View>
              <View style={styles.placeRowRight}>
                <View style={styles.placeCard}>
                  {place.main_image_url ? (
                    <Image source={{ uri: place.main_image_url }} style={styles.placeThumbnail} resizeMode="cover" />
                  ) : (
                    <View style={[styles.placeThumbnail, styles.placeThumbnailPlaceholder]} />
                  )}
                  <View style={styles.placeNameCol}>
                    <Text style={styles.placeName} numberOfLines={1}>
                      {place.name}
                    </Text>
                    {place.category && (
                      <Text style={styles.placeCategory} numberOfLines={1}>
                        {place.category}
                      </Text>
                    )}
                  </View>
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
      </ScrollView>

      <FloatingNav onHome={onExit} onCreateManual={onCreateManual} onCreateAI={onCreateAI} onProfile={onProfile} />
    </View>
  );
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
  // 흰 배경은 ScrollView 자체(dateTabScroll)에 둬야 탭이 1개뿐이라 content가 화면 폭보다 좁을 때도
  // 남는 공간이 페이지 배경(backgroundMuted)으로 비치지 않음 (CourseDetailScreen과 동일 이유)
  dateTabScroll: { backgroundColor: colors.white },
  dateTabRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
  },
  dateTab: { width: 36, height: 56, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 4 },
  dateTabSelected: { backgroundColor: colors.accentBlue },
  dateTabWeekday: { fontFamily: fonts.regular, fontSize: 16, letterSpacing: -0.4, color: colors.gray700 },
  dateTabDay: { fontFamily: fonts.regular, fontSize: 16, letterSpacing: -0.4, color: colors.gray700 },
  dateTabTextSelected: { color: colors.white },
  // 지도를 위아래로 더 보이게 확대(200→260, 사용자 요청 2026-09-10). 핀 모양은 components/MapPin.tsx
  // 참고(export_node_as_image로 실제 렌더 확인 후 물방울 핀 모양으로 재현)
  map: { width: '100%', height: 260 },
  // 헤더/제목은 좌우 여백 20이지만, 지도 아래 리스트 카드는 16 — CourseResultScreen과 동일 실측값
  listSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20, backgroundColor: colors.white },
  dayHeader: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.black, marginBottom: 12 },
  placeRow: { flexDirection: 'row' },
  placeRowLeft: { width: 32, alignItems: 'center' },
  // Figma 실측 스크린샷 확인(2026-09-10) — 실선이 아니라 점선. borderLeft+dotted로 구현(RN에서
  // 세로 점선을 그리는 표준 방법 — backgroundColor 실선 View로는 점선을 못 그림)
  placeConnector: { flex: 1, width: 0, borderLeftWidth: 1.5, borderLeftColor: colors.border, borderStyle: 'dotted', marginVertical: 4, minHeight: 30 },
  // 카드끼리 너무 붙어있다는 피드백(2026-09-11)으로 16→28 확대
  placeRowRight: { flex: 1, paddingBottom: 28 },
  placeCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeThumbnail: { width: 48, height: 48, borderRadius: 4 },
  placeThumbnailPlaceholder: { backgroundColor: colors.border },
  placeNameCol: { flex: 1 },
  placeName: { fontFamily: fonts.medium, fontSize: 16, letterSpacing: -0.4, color: colors.black },
  // Figma 실측(510:11285): 이름 바로 아래 카테고리 텍스트, 위아래 여백 없이 바짝 붙음(2026-09-11
  // category 필드 추가하면서 반영 — 백엔드에 필드 없던 때는 생략돼있었음)
  placeCategory: { fontFamily: fonts.regular, fontSize: 12, letterSpacing: -0.3, color: colors.gray400 },
  placeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  placeMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  placeMetaText: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray500 },
});
