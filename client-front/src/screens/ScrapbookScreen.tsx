import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CourseListItem, courseApi } from '../api/course';
import { PlaceListItem, placeApi } from '../api/place';
import { userApi } from '../api/user';
import { FloatingNav } from '../components/FloatingNav';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { CourseDetailScreen } from './CourseDetailScreen';
import { CourseEditScreen } from './CourseEditScreen';
import { PlaceDetailScreen } from './PlaceDetailScreen';

type ScrapTab = 'course' | 'place';

type Overlay =
  | { type: 'course-detail'; courseId: number }
  | { type: 'course-edit'; courseId: number }
  | { type: 'place-detail'; placeId: number };

interface Props {
  initialTab?: ScrapTab;
  onExit: () => void;
  // FloatingNav 중앙/우측 버튼용(2026-09-06 추가, decision-log 참고) — 이 화면을 여는 쪽
  // (HomeScreen 직접 또는 ProfileScreen을 거쳐)이 실제 동작을 쥐고 있어서 그대로 전달만 받음
  onCreateManual: () => void;
  onCreateAI: () => void;
  onProfile: () => void;
}

// 카드 안 장소 썸네일 스트립에 최대 몇 장까지 보여줄지 — 서버도 이 개수(3)만큼만 내려줌
// (CourseService.SCRAPBOOK_THUMBNAIL_LIMIT 참고), 나머지는 "N+" 배지로 뭉침
const COURSE_THUMBNAIL_LIMIT = 3;

// Figma 노드 485:10903("코스 저장")/488:11855("관광지 저장") — 두 프레임이 헤더·탭 구조는 동일하고
// 카드 내용만 다른 한 화면(스크랩북)의 두 탭이라 하나로 합침. 기존 MyCoursesScreen/LikesScreen을
// 대체함 (2026-09-03, decision-log 참고).
//
// 2026-09-05 재검토(Figma 원본 다시 확인, decision-log 참고):
// - 탭을 박스 버튼에서 원본과 같은 밑줄(underline) 스타일로 교체(HomeScreen 탭과 동일 패턴)
// - 코스 카드: 원본에 있던 장소 썸네일 3장+"N+" 배지를 백엔드에 place_thumbnails 필드를 새로
//   추가해서 반영(전엔 대표 썸네일 1장만 있어서 못 만들었음)
// - 관광지 카드: 원본에 있는 하트(찜 해제) 아이콘 추가 — is_liked로 이미 가능한데 빠져 있었음
//
// 여전히 뺀 것:
// - 코스 카드 우상단 하트(좋아요) 아이콘: 코스에는 "찜/좋아요" 개념 자체가 스키마에 없음
//   (course_like 같은 테이블 없음, PLACE_LIKE만 존재) → 없는 기능을 만드는 대신 생략
export function ScrapbookScreen({ initialTab = 'course', onExit, onCreateManual, onCreateAI, onProfile }: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<ScrapTab>(initialTab);
  const [courses, setCourses] = useState<CourseListItem[] | null>(null);
  const [places, setPlaces] = useState<PlaceListItem[] | null>(null);
  const [unlikeBusyId, setUnlikeBusyId] = useState<number | null>(null);
  const [overlay, setOverlay] = useState<Overlay | null>(null);

  useEffect(() => {
    loadCourses();
    loadPlaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCourses = useCallback(async () => {
    try {
      const response = await courseApi.myCourses();
      setCourses(response.courses);
    } catch (e) {
      Alert.alert('코스 목록을 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
      setCourses([]);
    }
  }, []);

  const loadPlaces = useCallback(async () => {
    try {
      const response = await userApi.getLikes();
      setPlaces(response.places);
    } catch (e) {
      Alert.alert('관광지 목록을 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
      setPlaces([]);
    }
  }, []);

  // 스크랩북은 "찜한 장소만" 모아보는 화면이라, 여기서 하트를 눌러 찜 해제하면 목록에서
  // 바로 사라지는 게 자연스러움(다시 불러오면 어차피 안 옴) — 로컬 상태에서 즉시 제거
  async function unlike(placeId: number) {
    if (unlikeBusyId != null) return;
    setUnlikeBusyId(placeId);
    try {
      await placeApi.unlike(placeId);
      setPlaces((prev) => (prev ?? []).filter((p) => p.id !== placeId));
    } catch (e) {
      Alert.alert('찜 해제에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setUnlikeBusyId(null);
    }
  }

  if (overlay?.type === 'course-edit') {
    const { courseId } = overlay;
    return (
      <CourseEditScreen
        courseId={courseId}
        onSaved={() => {
          setOverlay(null);
          loadCourses();
        }}
        onExit={() => setOverlay({ type: 'course-detail', courseId })}
      />
    );
  }

  if (overlay?.type === 'course-detail') {
    const { courseId } = overlay;
    return (
      <CourseDetailScreen
        courseId={courseId}
        onEdit={() => setOverlay({ type: 'course-edit', courseId })}
        onDeleted={() => {
          setOverlay(null);
          loadCourses();
        }}
        onExit={() => setOverlay(null)}
        onCreateManual={onCreateManual}
        onCreateAI={onCreateAI}
        onProfile={onProfile}
      />
    );
  }

  if (overlay?.type === 'place-detail') {
    return (
      <PlaceDetailScreen
        placeId={overlay.placeId}
        onExit={() => {
          setOverlay(null);
          loadPlaces(); // 상세에서 찜 해제했을 수 있으니 돌아오면 목록 갱신
        }}
      />
    );
  }

  const loading = tab === 'course' ? courses === null : places === null;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onExit} hitSlop={8} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>스크랩북</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity onPress={() => setTab('course')} style={styles.tabItem}>
          <Text style={[styles.tabLabel, tab === 'course' && styles.tabLabelActive]}>여행코스</Text>
          {tab === 'course' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('place')} style={styles.tabItem}>
          <Text style={[styles.tabLabel, tab === 'place' && styles.tabLabelActive]}>관광지</Text>
          {tab === 'place' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.black} />
        </View>
      ) : tab === 'course' ? (
        <FlatList
          data={courses ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>저장한 코스가 없어요.</Text>}
          renderItem={({ item }) => {
            const remaining = item.place_count - item.place_thumbnails.length;
            return (
              <TouchableOpacity
                style={styles.courseCard}
                onPress={() => setOverlay({ type: 'course-detail', courseId: item.id })}
              >
                {item.thumbnail_url ? (
                  <Image source={{ uri: item.thumbnail_url }} style={styles.cardImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
                )}
                <LinearGradient colors={['#00000000', '#000000']} style={styles.cardGradient} pointerEvents="none" />
                <View style={styles.courseCardText}>
                  <Text style={styles.courseTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.place_thumbnails.length > 0 && (
                    <View style={styles.thumbStrip}>
                      {item.place_thumbnails.slice(0, COURSE_THUMBNAIL_LIMIT).map((url, idx) => (
                        <Image key={idx} source={{ uri: url }} style={styles.thumbItem} resizeMode="cover" />
                      ))}
                      {remaining > 0 && (
                        <View style={[styles.thumbItem, styles.thumbMoreBadge]}>
                          <Text style={styles.thumbMoreText}>{remaining}+</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        <FlatList
          data={places ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>찜한 관광지가 없어요.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.placeCard}
              onPress={() => setOverlay({ type: 'place-detail', placeId: item.id })}
            >
              {item.main_image_url ? (
                <Image source={{ uri: item.main_image_url }} style={styles.cardImage} resizeMode="cover" />
              ) : (
                <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
              )}
              <LinearGradient colors={['#00000000', '#000000']} style={styles.cardGradient} pointerEvents="none" />
              <View style={styles.placeCardText}>
                <Text style={styles.placeName} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.addr1 && (
                  <Text style={styles.placeAddr} numberOfLines={1}>
                    {item.addr1}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => unlike(item.id)}
                disabled={unlikeBusyId === item.id}
                hitSlop={8}
                style={styles.placeLikeButton}
              >
                <Text style={styles.placeLikeIcon}>♥</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

      <FloatingNav onHome={onExit} onCreateManual={onCreateManual} onCreateAI={onCreateAI} onProfile={onProfile} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 8 },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 20, color: colors.black },
  headerTitle: { flex: 1, fontFamily: fonts.semiBold, fontSize: 16, color: colors.black, textAlign: 'center' },
  // HomeScreen 탭과 동일한 밑줄 스타일로 통일 (2026-09-05, 원래 박스 버튼이던 걸 Figma 원본대로 수정)
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  tabItem: { paddingVertical: 12 },
  tabLabel: { fontFamily: fonts.regular, fontSize: 16, letterSpacing: -0.4, color: colors.gray700 },
  tabLabelActive: { fontFamily: fonts.semiBold, color: colors.black },
  tabUnderline: { height: 2, backgroundColor: colors.black, marginTop: 10, borderRadius: 1 },
  list: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.gray400, textAlign: 'center', marginTop: 60 },
  cardImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  cardImagePlaceholder: { backgroundColor: colors.border },
  cardGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.6 },
  courseCard: { height: 236, borderRadius: 20, overflow: 'hidden', marginBottom: 20, backgroundColor: colors.border },
  courseCardText: { position: 'absolute', left: 20, right: 20, bottom: 20 },
  courseTitle: { fontFamily: fonts.medium, fontSize: 24, letterSpacing: -0.6, color: colors.white },
  thumbStrip: { flexDirection: 'row', gap: 6, marginTop: 12 },
  thumbItem: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  thumbMoreBadge: { backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', borderColor: 'transparent' },
  thumbMoreText: { fontFamily: fonts.medium, fontSize: 13, color: colors.white },
  // 사용자 요청으로 세로 높이 확대(168->200->224->230, 2026-09-09) — 텍스트/하트 버튼은
  // 전부 상하 가장자리 기준 absolute 배치라 높이만 키워도 레이아웃 안 깨짐
  placeCard: { height: 230, borderRadius: 16, overflow: 'hidden', marginBottom: 20, backgroundColor: colors.border },
  placeCardText: { position: 'absolute', left: 20, right: 56, bottom: 16 },
  placeName: { fontFamily: fonts.medium, fontSize: 20, letterSpacing: -0.5, color: colors.white },
  placeAddr: { fontFamily: fonts.regular, fontSize: 12, letterSpacing: -0.3, color: '#cccccc', marginTop: 4 },
  placeLikeButton: { position: 'absolute', right: 20, bottom: 16, padding: 4 },
  placeLikeIcon: { fontSize: 20, color: '#ff4d4d' },
});
