import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CourseListItem, courseApi } from '../api/course';
import { PlaceListItem } from '../api/place';
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
}

// Figma 노드 485:10903("코스 저장")/488:11855("관광지 저장") — 두 프레임이 헤더·탭 구조는 동일하고
// 카드 내용만 다른 한 화면(스크랩북)의 두 탭이라 하나로 합침. 기존 MyCoursesScreen/LikesScreen을
// 대체함 (2026-09-03, decision-log 참고).
//
// 원본 디자인과 다르게 뺀 것:
// - 코스 카드의 장소 썸네일 3장 스트립 + "N+" 배지: CourseListItem에 코스 안 개별 장소의 썸네일 목록이
//   없어서(썸네일 1장만 옴) 만들 수 없음 → "장소 N곳" 텍스트로 대체
// - 코스 카드 우상단 좋아요 버튼: 코스에는 "찜" 개념 자체가 스키마에 없음(PLACE_LIKE만 존재) → 생략
export function ScrapbookScreen({ initialTab = 'course', onExit }: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<ScrapTab>(initialTab);
  const [courses, setCourses] = useState<CourseListItem[] | null>(null);
  const [places, setPlaces] = useState<PlaceListItem[] | null>(null);
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

  function handleShare() {
    Share.share({ message: '안동 여행, 동글과 함께 떠나보세요 🌿' }).catch(() => {});
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
        <TouchableOpacity
          style={[styles.tabButton, styles.tabButtonLeft, tab === 'course' && styles.tabButtonActive]}
          onPress={() => setTab('course')}
        >
          <Text style={[styles.tabLabel, tab === 'course' && styles.tabLabelActive]}>여행코스</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, styles.tabButtonRight, tab === 'place' && styles.tabButtonActive]}
          onPress={() => setTab('place')}
        >
          <Text style={[styles.tabLabel, tab === 'place' && styles.tabLabelActive]}>관광지</Text>
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
          renderItem={({ item }) => (
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
                <Text style={styles.courseMeta}>
                  {item.travel_date ?? '날짜 미정'} · 장소 {item.place_count}곳
                </Text>
              </View>
            </TouchableOpacity>
          )}
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
            </TouchableOpacity>
          )}
        />
      )}

      <FloatingNav onHome={onExit} onShare={handleShare} />
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
  tabRow: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 8 },
  tabButton: { flex: 1, height: 44, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  tabButtonLeft: { borderTopLeftRadius: 8, borderBottomLeftRadius: 8, borderRightWidth: 0 },
  tabButtonRight: { borderTopRightRadius: 8, borderBottomRightRadius: 8 },
  tabButtonActive: { borderColor: colors.black },
  tabLabel: { fontFamily: fonts.regular, fontSize: 16, letterSpacing: -0.4, color: colors.gray500 },
  tabLabelActive: { fontFamily: fonts.semiBold, color: colors.black },
  list: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.gray400, textAlign: 'center', marginTop: 60 },
  cardImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  cardImagePlaceholder: { backgroundColor: colors.border },
  cardGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.6 },
  courseCard: { height: 236, borderRadius: 20, overflow: 'hidden', marginBottom: 20, backgroundColor: colors.border },
  courseCardText: { position: 'absolute', left: 20, right: 20, bottom: 20 },
  courseTitle: { fontFamily: fonts.medium, fontSize: 24, letterSpacing: -0.6, color: colors.white },
  courseMeta: { fontFamily: fonts.regular, fontSize: 13, letterSpacing: -0.3, color: '#cccccc', marginTop: 6 },
  placeCard: { height: 184, borderRadius: 16, overflow: 'hidden', marginBottom: 20, backgroundColor: colors.border },
  placeCardText: { position: 'absolute', left: 20, right: 20, bottom: 16 },
  placeName: { fontFamily: fonts.medium, fontSize: 20, letterSpacing: -0.5, color: colors.white },
  placeAddr: { fontFamily: fonts.regular, fontSize: 12, letterSpacing: -0.3, color: '#cccccc', marginTop: 4 },
});
