import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CourseCandidate, CoursePlaceItem, CoursePlaceRequest, courseApi } from '../api/course';
import { SwipeTransport } from '../api/swipe';
import { BookmarkIcon, DistanceIcon, HeartIcon, MapPinOutlineIcon, SearchIcon, WalkIcon } from '../components/icons';
import { FloatingNav } from '../components/FloatingNav';
import { MapPin } from '../components/MapPin';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { SearchScreen } from './SearchScreen';

interface Props {
  sessionId: string;
  travelDate: string;
  // 여행 날짜 다중 선택 지원(2026-09-10 추가) — 없으면 travelDate 하루짜리(기존과 동일)
  endDate?: string | null;
  transport: SwipeTransport;
  // "여행일정 등록" 화면(CourseFlowScreen)에서 받은 시작/종료 시간 — 없으면(둘 다 null) 서버가
  // 09:00~21:00으로 폴백(2026-09-09 추가, api/course.ts 참고)
  startTime?: string | null;
  endTime?: string | null;
  onSaved: () => void;
  onCancel: () => void;
  // FloatingNav 전달용(2026-09-10 추가) — CourseFlowScreen이 HomeScreen의 overlay로 전체화면
  // 교체돼서(course-manual과 동일 구조) 배경에 다른 FloatingNav가 없음, 이 화면이 직접 그려야 함
  onCreateManual: () => void;
  onCreateAI: () => void;
  onProfile: () => void;
}

const ANDONG_REGION = { latitude: 36.5684, longitude: 128.7294, latitudeDelta: 0.1, longitudeDelta: 0.1 };
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function formatDayTabLabel(dateKey: string) {
  const d = new Date(dateKey + 'T00:00:00');
  return { weekday: WEEKDAY_LABELS[d.getDay()], day: d.getDate() };
}

function formatShortDateLabel(dateKey: string) {
  const [, m, d] = dateKey.split('-').map(Number);
  const weekday = WEEKDAY_LABELS[new Date(dateKey + 'T00:00:00').getDay()];
  return `${m}/${d}(${weekday})`;
}

// Figma 노드 510:11285("AI 일정 만들기-화면") 재실측 반영(2026-09-10, 채널 h962fplg) — 이전엔
// 이 노드를 참고했다면서도 실제로는 헤더 하트/돋보기/북마크, 제목 옆 연필, 파란 번호 핀, "AI 추천
// 여행 코스" 섹션 타이틀, 하단 플로팅 네비 등 시안의 핵심 요소 다수가 코드에 빠져있었음(사용자
// 지적, 2026-09-10) — CourseDetailScreen.tsx(같은 시안 계열, 501:12088)이 이미 검증해둔 헤더/핀/
// 리스트 스타일을 그대로 재사용하고, 이 화면 전용 값(리스트 영역 좌우 여백 16 — 헤더의 20과는
// 다름, 섹션 타이틀 색 #373b51)은 이번에 새로 실측해서 반영함.
//
// 시안의 "AI 추천 여행 코스" Section Title 컴포넌트엔 "Blogs"/"편집"/Lorem ipsum 문단이 같이 붙어
// 있는데, 이건 범용 UI킷 컴포넌트를 그대로 꽂아 넣은 잔재라 배제함(437:4426 Lorem ipsum 잔재
// 배제와 동일 판단, decision-log 참고) — "AI 추천 여행 코스" 텍스트만 실제 의도로 보임.
//
// 카드별 카테고리 라벨(예: "관광명소")은 CoursePlaceItem에 카테고리 필드가 없어서 생략(없는 데이터를
// 지어내지 않기 위한 선택, CourseDetailScreen과 동일 판단). "장소 추가" 버튼은 저장 전 candidate라
// 백엔드에 받쳐줄 API 자체가 없어서 제외(사용자 확인, 2026-09-10) — 이 화면의 책임이 아니라
// CourseEditScreen 몫이라는 기존 판단 유지. 총 거리/시간 요약 텍스트도 시안엔 없어서 제거함
// (CourseDetailScreen도 개별 장소 메타만 보여주고 총합은 안 보여주는 것과 일관됨).
//
// 여러 날 여행(endDate) 지원(2026-09-10 추가, 사용자 확인 — 날짜별로 따로 AI 추천해서 N박N일로
// 합침) — 서버가 날짜마다 course_optimizer를 따로 불러 만든 CoursePlaceItem.visit_date를 그대로
// 써서 CourseDetailScreen.tsx와 동일한 날짜 탭 UI로 필터링. 서버가 후보 부족으로 요청한 기간보다
// 적은 날짜만 만들었을 수 있어서(CourseService.generate 참고) 탭은 요청한 endDate가 아니라 실제
// 응답에 들어있는 visit_date들만으로 만듦
export function CourseResultScreen({
  sessionId,
  travelDate,
  endDate,
  transport,
  startTime,
  endTime,
  onSaved,
  onCancel,
  onCreateManual,
  onCreateAI,
  onProfile,
}: Props) {
  const insets = useSafeAreaInsets();
  const [candidate, setCandidate] = useState<CourseCandidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDateTab, setSelectedDateTab] = useState('');
  const [title, setTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);

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
        end_date: endDate,
        transport,
        start_time: startTime,
        end_time: endTime,
      });
      // 스펙상 최대 3개지만 course_optimizer 한계로 지금은 항상 1개 (decision-log 2026-08-30 참고)
      const result = response.candidates[0] ?? null;
      setCandidate(result);
      setTitle(result?.title ?? '');
      setSelectedDateTab(result?.places[0]?.visit_date ?? travelDate);
    } catch (e) {
      Alert.alert('코스 생성에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }

  // 실제 응답에 들어있는 visit_date만 모아서 정렬 — 위 코멘트 참고(요청한 기간보다 적게 만들어질 수 있음)
  const dateTabs = useMemo(() => {
    if (!candidate) return [];
    const unique = Array.from(new Set(candidate.places.map((p) => p.visit_date).filter((d): d is string => d != null)));
    return unique.sort();
  }, [candidate]);

  const placesForTab: CoursePlaceItem[] =
    candidate == null ? [] : dateTabs.length === 0 ? candidate.places : candidate.places.filter((p) => p.visit_date === selectedDateTab);

  function commitTitle() {
    setEditingTitle(false);
    if (title.trim() === '') setTitle(candidate?.title ?? '');
  }

  async function handleSave() {
    if (!candidate) return;
    setSaving(true);
    try {
      const places: CoursePlaceRequest[] = candidate.places.map((place) => ({
        place_id: place.place_id,
        visit_order: place.visit_order,
        planned_time: place.planned_time,
        visit_date: place.visit_date,
      }));
      // 요청한 endDate가 아니라 실제로 만들어진 마지막 날짜를 저장 — 후보 부족으로 서버가 요청한
      // 기간보다 적게 만들었을 수 있어서(위 코멘트 참고), 실제 장소 데이터와 어긋나지 않게 함
      const actualEndDate = dateTabs.length > 0 ? dateTabs[dateTabs.length - 1] : null;
      await courseApi.save({
        candidate_id: candidate.candidate_id,
        title: title.trim() || candidate.title,
        travel_date: travelDate,
        end_date: actualEndDate,
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

  const pinnedPlaces = placesForTab.filter((p) => p.lat != null && p.lng != null);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.headerTop, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={onCancel} hitSlop={8} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerIcons}>
            {/* 하트/북마크는 대응하는 백엔드 기능이 없어서(코스엔 좋아요/찜 개념 자체가 스키마에
                없음) 장식만 — CourseDetailScreen과 동일 판단 */}
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
          {editingTitle ? (
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              autoFocus
              onBlur={commitTitle}
              onSubmitEditing={commitTitle}
              returnKeyType="done"
              maxLength={30}
            />
          ) : (
            <Text style={styles.titleText} numberOfLines={1}>
              {title}
            </Text>
          )}
          <TouchableOpacity onPress={() => setEditingTitle(true)} hitSlop={8} disabled={saving}>
            <Text style={styles.pencilIcon}>✎</Text>
          </TouchableOpacity>
        </View>

        {dateTabs.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dateTabScroll}
            contentContainerStyle={styles.dateTabRow}
          >
            {dateTabs.map((dateKey) => {
              const selected = dateKey === selectedDateTab;
              const { weekday, day } = formatDayTabLabel(dateKey);
              return (
                <TouchableOpacity
                  key={dateKey}
                  style={[styles.dateTab, selected && styles.dateTabSelected]}
                  onPress={() => setSelectedDateTab(dateKey)}
                >
                  <Text style={[styles.dateTabWeekday, selected && styles.dateTabTextSelected]}>{weekday}</Text>
                  <Text style={[styles.dateTabDay, selected && styles.dateTabTextSelected]}>{day}</Text>
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
          <Text style={styles.sectionTitle}>AI 추천 여행 코스</Text>

          {dateTabs.length > 1 && selectedDateTab && <Text style={styles.dayHeader}>{formatShortDateLabel(selectedDateTab)}</Text>}

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

          <TouchableOpacity style={styles.primaryButton} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>이 코스 저장하기</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <FloatingNav onHome={onCancel} onCreateManual={onCreateManual} onCreateAI={onCreateAI} onProfile={onProfile} />

      <Modal visible={searchVisible} transparent animationType="none" onRequestClose={() => setSearchVisible(false)}>
        <SearchScreen onExit={() => setSearchVisible(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, padding: 24 },
  loadingText: { marginTop: 12, fontFamily: fonts.regular, fontSize: 14, color: colors.gray500 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.gray700, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  scrollContent: { paddingBottom: 140 }, // 플로팅 네비에 안 가리게 여유
  // Figma 실측(510:11285): 헤더+제목+날짜탭이 흰 풀블리드 블록(#ffffff, 페이지 배경 #f7f7fb 위),
  // 지도/리스트도 각각 별도 흰 블록 — CourseDetailScreen과 같은 카드 분리 패턴
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
    paddingBottom: 15,
    backgroundColor: colors.white,
  },
  titleText: { fontFamily: fonts.semiBold, fontSize: 24, letterSpacing: -0.6, color: colors.black, flexShrink: 1 },
  titleInput: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 24,
    letterSpacing: -0.6,
    color: colors.black,
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pencilIcon: { fontSize: 15, color: colors.gray500 },
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
  // 헤더/제목은 좌우 여백 20이지만, 지도 아래 리스트 카드는 16 — Figma가 이 프레임에서 실제로
  // 다르게 쓴 값이라 그대로 따름(2026-09-10 실측, CourseDetailScreen의 20과 다른 부분)
  listSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20, backgroundColor: colors.white },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.sectionTitle, marginBottom: 12 },
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
  primaryButton: { height: 52, borderRadius: 8, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryButtonText: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.24, color: colors.white },
  secondaryButton: { height: 48, paddingHorizontal: 24, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontFamily: fonts.medium, fontSize: 15, color: colors.black },
});
