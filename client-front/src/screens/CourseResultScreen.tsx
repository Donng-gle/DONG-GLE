import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { MAP_PROVIDER } from '../utils/mapProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CourseCandidate, CoursePlaceItem, CoursePlaceRequest, courseApi } from '../api/course';
import { SwipeTransport } from '../api/swipe';
import { DistanceIcon, HeartIcon, MapPinOutlineIcon, WalkIcon } from '../components/icons';
import { FloatingNav } from '../components/FloatingNav';
import { MapPin } from '../components/MapPin';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { formatPlannedTime } from '../utils/formatPlannedTime';

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
  // FloatingNav 전달용(2026-09-10 추가) — CourseFlowScreen이 HomeScreen의 overlay로 전체화면
  // 교체돼서(course-manual과 동일 구조) 배경에 다른 FloatingNav가 없음, 이 화면이 직접 그려야 함
  onCreateManual: () => void;
  onCreateAI: () => void;
  onProfile: () => void;
}

const ANDONG_REGION = { latitude: 36.5684, longitude: 128.7294, latitudeDelta: 0.1, longitudeDelta: 0.1 };

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
// 여러 날 여행(endDate) 지원은 2026-09-10에 추가했다가 2026-09-11 사용자 요청으로 다시 뺌 — AI
// 추천은 항상 하루짜리 일정만 생성(날짜 탭 UI도 같이 제거, CourseFlowScreen 참고)
export function CourseResultScreen({
  sessionId,
  travelDate,
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
  const [title, setTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  // 하트 = 즉시 저장(확인 없이), 하단 "이 코스 저장하기" = 기존처럼 확인 알림 후 저장 → 완료(사용자
  // 확인, 2026-09-11 — 헤더 돋보기/북마크 제거, 하트만 남기고 실제 저장 기능 연결). 저장된 코스 id를
  // 들고 있다가 이미 저장됐으면 두 번째 트리거(버튼 or 하트)에서 또 POST하지 않도록 함(중복 저장 방지)
  const [savedCourseId, setSavedCourseId] = useState<number | null>(null);

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
      const result = response.candidates[0] ?? null;
      setCandidate(result);
      setTitle(result?.title ?? '');
    } catch (e) {
      Alert.alert('코스 생성에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }

  const places: CoursePlaceItem[] = candidate?.places ?? [];

  function commitTitle() {
    setEditingTitle(false);
    if (title.trim() === '') setTitle(candidate?.title ?? '');
  }

  // candidate_id는 백엔드가 "이 candidate를 이미 저장했는지" 추적하지 않아서(그냥 매번 새 코스로
  // insert) savedCourseId로 프론트에서 직접 중복 방지. 이미 저장됐으면 새 요청 없이 그 id를 그대로
  // 반환(하트로 먼저 저장한 뒤 하단 버튼을 눌러도 코스가 두 번 생기지 않게)
  async function saveCourse(): Promise<number | null> {
    if (!candidate) return null;
    if (savedCourseId != null) return savedCourseId;
    setSaving(true);
    try {
      const places: CoursePlaceRequest[] = candidate.places.map((place) => ({
        place_id: place.place_id,
        visit_order: place.visit_order,
        planned_time: place.planned_time,
        visit_date: place.visit_date,
      }));
      const res = await courseApi.save({
        candidate_id: candidate.candidate_id,
        title: title.trim() || candidate.title,
        travel_date: travelDate,
        end_date: null,
        transport,
        source: 'ai',
        places,
      });
      setSavedCourseId(res.course_id);
      return res.course_id;
    } catch (e) {
      Alert.alert('코스 저장에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
      return null;
    } finally {
      setSaving(false);
    }
  }

  // 하트: 즉시 저장(성공하면 하트가 채워짐), 확인 알림 없이 화면에 남아있음 — 계속 둘러보다 하단
  // 버튼으로 마무리할 수 있게
  async function handleHeartPress() {
    if (savedCourseId != null || saving) return;
    await saveCourse();
  }

  async function handleSave() {
    const id = await saveCourse();
    if (id != null) Alert.alert('코스가 저장됐어요', undefined, [{ text: '확인', onPress: onSaved }]);
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

  const pinnedPlaces = places.filter((p) => p.lat != null && p.lng != null);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.headerTop, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={onCancel} hitSlop={8} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerIcons}>
            {/* 돋보기/북마크 제거, 하트만 남김(사용자 확인, 2026-09-11) — 눌러서 바로 저장,
                저장되면 채워진 하트로 표시 */}
            <TouchableOpacity onPress={handleHeartPress} hitSlop={6} disabled={saving} style={styles.headerIconButton}>
              <HeartIcon size={22} filled={savedCourseId != null} />
            </TouchableOpacity>
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

        {pinnedPlaces.length > 0 && (
          <MapView provider={MAP_PROVIDER} style={styles.map} initialRegion={ANDONG_REGION}>
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

          {places.map((place, index) => (
            <View key={place.place_id} style={styles.placeRow}>
              <View style={styles.placeRowLeft}>
                <MapPinOutlineIcon size={18} />
                {index < places.length - 1 && <View style={styles.placeConnector} />}
              </View>
              <View style={styles.placeRowRight}>
                <View style={styles.placeCard}>
                  {place.main_image_url ? (
                    <Image source={{ uri: place.main_image_url }} style={styles.placeThumbnail} resizeMode="cover" />
                  ) : (
                    <View style={[styles.placeThumbnail, styles.placeThumbnailPlaceholder]} />
                  )}
                  <View style={styles.placeNameCol}>
                    {formatPlannedTime(place.planned_time) && (
                      <Text style={styles.placeTime}>{formatPlannedTime(place.planned_time)}</Text>
                    )}
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
  // 지도를 위아래로 더 보이게 확대(200→260, 사용자 요청 2026-09-10). 핀 모양은 components/MapPin.tsx
  // 참고(export_node_as_image로 실제 렌더 확인 후 물방울 핀 모양으로 재현)
  map: { width: '100%', height: 260 },
  // 헤더/제목은 좌우 여백 20이지만, 지도 아래 리스트 카드는 16 — Figma가 이 프레임에서 실제로
  // 다르게 쓴 값이라 그대로 따름(2026-09-10 실측, CourseDetailScreen의 20과 다른 부분)
  listSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20, backgroundColor: colors.white },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.sectionTitle, marginBottom: 12 },
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
  placeTime: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: -0.3, color: colors.gray500 },
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
