import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CourseDetail, CoursePlaceItem, courseApi } from '../api/course';
import { BookmarkIcon, DistanceIcon, HeartIcon, MapPinOutlineIcon, SearchIcon, WalkIcon } from '../components/icons';
import { FloatingNav } from '../components/FloatingNav';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { SearchScreen } from './SearchScreen';

interface Props {
  courseId: number;
  onEdit: () => void;
  onDeleted: () => void;
  onExit: () => void;
  onCreateManual: () => void;
  onCreateAI: () => void;
  onProfile: () => void;
}

const ANDONG_REGION = { latitude: 36.5684, longitude: 128.7294, latitudeDelta: 0.1, longitudeDelta: 0.1 };
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// travel_date~end_date를 하루 단위로 나열 — CourseManualBuilderScreen.tsx의 동명 함수와 동일 로직
// (저장된 코스를 "다시" 날짜 탭으로 쪼개 보여주는 용도라 여기선 실제 저장된 날짜 범위 기준)
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

// Figma "직접 일정 만들기-기본화면"(501:12088, 채널 3ussd0cc, 2026-09-09 재실측) 그대로 재구현 —
// 예전엔(437:4426, Lorem ipsum 등 템플릿 잔재가 섞인 시안 배제 후) 전용 시안이 없어서
// CourseResultScreen 지도/리스트를 그대로 재사용했는데, 이번에 실제 시안을 받아서 전면 교체함.
//
// 헤더(하트/돋보기/북마크)·제목+연필·날짜 탭·지도 스타일은 CourseManualBuilderScreen(같은 프레임
// 계열, 501:12543 빈 상태 포함)이 이미 검증해둔 값 그대로 재사용. 이 화면(저장된 코스 "자세히
// 보기")에서 새로 필요했던 부분:
// - 날짜 탭으로 실제 저장된 place.visit_date를 걸러서 보여줌(빌더는 편집 중인 draft라 날짜별 배열을
//   직접 관리하지만, 여긴 이미 저장된 CoursePlaceItem[] 하나를 visit_date로 다시 나눔). AI 코스는
//   visit_date가 항상 null(단일 날짜 전제, api/course.ts 참고)이라 그 경우엔 필터 없이 전체를 보여줌
//   (PublicCourseDetailScreen.tsx의 hasVisitDates 판정과 동일 패턴)
// - 장소 리스트 행: Figma는 이름 아래 카테고리 텍스트("관광명소" 등)도 보여주는데 CoursePlaceItem엔
//   category 필드 자체가 없어서(PlaceListItem에만 있음) 생략 — 없는 데이터를 지어내지 않기 위한 선택
//   (다른 화면들과 동일 원칙)
// - 거리/시간: Figma 그대로 아이콘 2개(핀+길, 뛰는 사람)로 분리해서 양끝 정렬. CourseManualBuilderScreen은
//   저장 전 초안이라 좌표 직선거리로 추정했지만, 여긴 이미 저장된 코스라 백엔드가 실제 경로로 계산해둔
//   distance_from_prev_km/duration_from_prev_min을 그대로 씀(더 정확함)
// - 헤더 돋보기: 장식만인 하트/북마크와 달리 PlaceDetailScreen과 동일한 패턴(SearchScreen을 투명
//   모달로 띄움)으로 실제 동작하게 함 — 시안 컨텍스트가 "장소 추가"가 아니라 읽기 전용 상세라
//   CourseManualBuilderScreen처럼 장소 추가 화면으로 보내는 건 안 맞다고 판단
// - 코스 삭제: 시안엔 없지만 기존 기능이라 퇴보 안 되게 하단에 유지(CourseManualBuilderScreen이
//   시안에 없는 저장/장소 조작 컨트롤을 유지한 것과 같은 판단)
export function CourseDetailScreen({ courseId, onEdit, onDeleted, onExit, onCreateManual, onCreateAI, onProfile }: Props) {
  const insets = useSafeAreaInsets();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedDateTab, setSelectedDateTab] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function load() {
    try {
      const detail = await courseApi.getDetail(courseId);
      setCourse(detail);
      if (detail.travel_date) setSelectedDateTab(detail.travel_date);
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

  const dateTabs = useMemo(
    () => (course?.travel_date ? buildDateTabs(course.travel_date, course.end_date) : []),
    [course?.travel_date, course?.end_date],
  );

  // AI 코스처럼 visit_date가 아예 없는 경우엔 필터 없이 전체를 보여줌(위 코멘트 참고)
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
            {/* 하트/북마크는 대응하는 백엔드 기능이 없어서(코스엔 좋아요/찜 개념 자체가 스키마에
                없음, PLACE_LIKE만 존재) 장식만 — CourseManualBuilderScreen과 동일 판단 */}
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
          <TouchableOpacity onPress={onEdit} hitSlop={8} disabled={deleting}>
            <Text style={styles.pencilIcon}>✎</Text>
          </TouchableOpacity>
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
                <View style={styles.pinWrap}>
                  <View style={styles.pinCircle}>
                    <Text style={styles.pinText}>{p.visit_order}</Text>
                  </View>
                  <View style={styles.pinShadow} />
                </View>
              </Marker>
            ))}
          </MapView>
        )}

        <View style={styles.listSection}>
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
                  <Text style={styles.placeName} numberOfLines={1}>
                    {place.name}
                  </Text>
                </View>
                {place.distance_from_prev_km != null && (
                  <View style={styles.placeMetaRow}>
                    <View style={styles.placeMetaItem}>
                      <DistanceIcon size={16} />
                      <Text style={styles.placeMetaText}>{place.distance_from_prev_km.toFixed(1)} KM</Text>
                    </View>
                    {place.duration_from_prev_min != null && (
                      <View style={styles.placeMetaItem}>
                        <WalkIcon size={16} />
                        <Text style={styles.placeMetaText}>{place.duration_from_prev_min}분</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity onPress={confirmDelete} disabled={deleting} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>{deleting ? '삭제 중...' : '코스 삭제'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <FloatingNav onHome={onExit} onCreateManual={onCreateManual} onCreateAI={onCreateAI} onProfile={onProfile} />

      <Modal visible={searchVisible} transparent animationType="none" onRequestClose={() => setSearchVisible(false)}>
        <SearchScreen onExit={() => setSearchVisible(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  scrollContent: { paddingBottom: 140 }, // 플로팅 네비에 안 가리게 여유
  // Figma 실측(501:12088): 헤더+제목+날짜탭이 흰 풀블리드 블록(#ffffff, 페이지 배경 #f7f7fb 위),
  // 지도/리스트도 각각 별도 흰 블록 — PlaceDetailScreen과 같은 카드 분리 패턴
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
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.white,
  },
  titleText: { fontFamily: fonts.semiBold, fontSize: 24, letterSpacing: -0.6, color: colors.black, flexShrink: 1 },
  pencilIcon: { fontSize: 15, color: colors.gray500 },
  // 흰 배경은 ScrollView 자체(dateTabScroll)에 둬야 탭이 1개뿐이라 content가 화면 폭보다 좁을 때도
  // 남는 공간이 페이지 배경(backgroundMuted)으로 비치지 않음 — contentContainerStyle에만 배경을
  // 두면 실제 콘텐츠 크기만큼만 칠해짐(2026-09-09 실기기 확인)
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
  map: { width: '100%', height: 166 },
  // Figma 실측: 파스텔 핑크 원(#fcf3f6, colors.pinBackground — 이 프레임 전용으로 이미 토큰화돼있던
  // 값) + 파란 굵은 번호 + 파란 반투명 꼬리. CourseManualBuilderScreen의 지도 핀과 동일 스타일
  pinWrap: { alignItems: 'center' },
  pinCircle: { width: 25, height: 25, borderRadius: 13, backgroundColor: colors.pinBackground, alignItems: 'center', justifyContent: 'center' },
  pinText: { fontFamily: fonts.bold, fontSize: 13, color: colors.accentBlue },
  pinShadow: { width: 20, height: 4, borderRadius: 2, backgroundColor: colors.accentBlue, opacity: 0.35, marginTop: 3 },
  listSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, backgroundColor: colors.white },
  dayHeader: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.black, marginBottom: 12 },
  placeRow: { flexDirection: 'row' },
  placeRowLeft: { width: 24, alignItems: 'center' },
  placeConnector: { flex: 1, width: 1, backgroundColor: colors.border, marginVertical: 4, minHeight: 30 },
  placeRowRight: { flex: 1, marginLeft: 8, paddingBottom: 16 },
  placeCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeThumbnail: { width: 48, height: 48, borderRadius: 4 },
  placeThumbnailPlaceholder: { backgroundColor: colors.border },
  placeName: { flex: 1, fontFamily: fonts.medium, fontSize: 16, letterSpacing: -0.4, color: colors.black },
  // Figma: 핀+길 아이콘·거리 텍스트는 왼쪽, 뛰는사람 아이콘·시간 텍스트는 오른쪽 끝(space-between)
  placeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginLeft: 60, // 썸네일(48)+gap(12)만큼 들여써서 이름 텍스트 시작 위치에 맞춤
  },
  placeMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  placeMetaText: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray500 },
  deleteButton: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 20, marginTop: 12 },
  deleteButtonText: { fontFamily: fonts.medium, fontSize: 14, color: colors.danger },
});
