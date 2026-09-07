import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlaceDetail, placeApi } from '../api/place';
import { PlaceLogsResponse, visitLogApi } from '../api/visitLog';
import { StarRating } from '../components/StarRating';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

interface Props {
  placeId: number;
  onExit: () => void;
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// 히어로 이미지 갤러리 한 장의 너비 — 실기기 화면 너비를 그대로 씀. 원래 360(디자인 시안의 아이폰
// 기준폭으로 보임)으로 하드코딩돼 있었는데, pagingEnabled는 ScrollView 자체의(=화면) 너비 단위로
// 스냅하기 때문에 실제 화면 폭이 360과 다르면(대부분의 안드로이드 기기가 그럼) 한 페이지 넘길 때마다
// 어긋나서 다음 이미지 앞부분이 계속 붙어 보이는 문제가 있었음 (2026-09-05, decision-log 참고)
const HERO_IMAGE_WIDTH = Dimensions.get('window').width;

// 리뷰 2열 그리드 타일 너비 — Figma 실측(458:2474 "Frame 2147227174" 등): 좌우 패딩20+열 사이
// 간격8인 320폭 안에 156짜리 타일 2개(320=156*2+8). 화면 폭이 360이 아닐 수 있어서(위 히어로
// 이미지와 같은 이유) 하드코딩 대신 HERO_IMAGE_WIDTH 기준으로 역산 — 타일 높이는 실측 비율
// 216/156을 그대로 곱함(2026-09-07 추가)
const REVIEW_GRID_GAP = 8;
const REVIEW_TILE_WIDTH = (HERO_IMAGE_WIDTH - 40 - REVIEW_GRID_GAP) / 2;
const REVIEW_TILE_HEIGHT = REVIEW_TILE_WIDTH * (216 / 156);

// Figma 리뷰 카드는 "2026년 6월 여행"처럼 일자 없이 연/월만 보여줌 — 실제 visited_at(정확한 날짜)을
// 그 표기 그대로 가공한 것뿐, 없는 데이터를 지어낸 건 아님
function formatVisitMonth(visitedAt: string) {
  const d = new Date(visitedAt);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 여행`;
}

function formatHours(hours: PlaceDetail['hours']) {
  return hours.map((h) => {
    const open = `${WEEKDAY_LABELS[h.open_day]} ${h.open_time.slice(0, 5)}`;
    if (h.close_time == null) return `${open} ~ 24시간`;
    const closeDayLabel = h.close_day != null && h.close_day !== h.open_day ? `${WEEKDAY_LABELS[h.close_day]} ` : '';
    return `${open} ~ ${closeDayLabel}${h.close_time.slice(0, 5)}`;
  });
}

// Figma 노드 354:1345/458:2474/358:5134("관광지 상세 페이지") 중 458:2474(리뷰 섹션 재설계본)를
// 기준으로 재실측. 작성자 프로필/좋아요·댓글 수/"가는 방법"은 대응하는 백엔드 데이터가 없어서 여전히
// 생략(place_like엔 개수가 아니라 내 찜 여부만 있음, VisitLogSummary엔 작성자 정보 자체가 없음) —
// 없는 데이터를 지어내지 않기 위한 선택 (2026-09-01 결정, decision-log 참고). 별점(rating/
// avg_rating)은 2026-09-05에 백엔드에 새로 추가돼서 더 이상 생략 대상이 아님 — overview 아래
// 평균 별점 표시. 헤더 돋보기/북마크/타이틀은 2026-09-07에 한 번 추가했다가(458:2474 실측 그대로)
// 사용자가 실기기로 확인 후 "빼자"고 정정해서 뒤로가기만 남기는 걸로 다시 되돌림(decision-log 참고)
export function PlaceDetailScreen({ placeId, onExit }: Props) {
  const insets = useSafeAreaInsets();
  const [place, setPlace] = useState<PlaceDetail | null>(null);
  const [logs, setLogs] = useState<PlaceLogsResponse | null>(null);
  const [likeBusy, setLikeBusy] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId]);

  async function load() {
    try {
      const [placeResult, logsResult] = await Promise.all([
        placeApi.getDetail(placeId),
        visitLogApi.logsForPlace(placeId),
      ]);
      setPlace(placeResult);
      setLogs(logsResult);
    } catch (e) {
      Alert.alert('장소 정보를 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
      onExit();
    }
  }

  async function toggleLike() {
    if (!place || likeBusy) return;

    // is_liked가 null이면 비인증 조회(PlaceDetail.is_liked, api/place.ts 참고) — 게스트라는 뜻.
    // 예전엔 이 경우에도 그냥 API를 호출해서 401을 받은 뒤에야 실패 얼럿을 띄웠는데, 결과가 뻔한
    // 요청이라 처음부터 안내만 하고 호출 자체를 생략함 (2026-09-04 발견/수정, decision-log 참고)
    if (place.is_liked === null) {
      Alert.alert('로그인이 필요해요', '찜하려면 먼저 로그인해주세요.');
      return;
    }

    setLikeBusy(true);
    try {
      const result = place.is_liked ? await placeApi.unlike(place.id) : await placeApi.like(place.id);
      setPlace({ ...place, is_liked: result.is_liked });
    } catch (e) {
      Alert.alert('찜 처리에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLikeBusy(false);
    }
  }

  if (!place) {
    return (
      <View style={styles.center}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={colors.black} />
      </View>
    );
  }

  // images 배열 첫 장이 main_image_url과 같은 사진으로 오는 경우(백엔드가 대표사진을 갤러리에도
  // 포함시켜 내려줄 수 있음, 목업 데이터에서 실제로 이렇게 겹치는 걸 확인함, 2026-09-05)를 대비해
  // 중복 URL은 걸러냄 — 안 그러면 스와이프해도 같은 사진이 반복돼 "안 넘어가는 것처럼" 보임
  const photos = Array.from(
    new Set([place.main_image_url, ...place.images.map((i) => i.img_url)].filter((url): url is string => url != null)),
  );
  const hoursLines = formatHours(place.hours);
  const chips = [...place.top_tags, place.category];

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* 뒤로가기만 — 458:2474 실측대로 타이틀/돋보기/북마크를 한 번 넣어봤다가(2026-09-07) 실기기로
          보니 별로라 사용자가 정정해서 원래대로(2026-09-05) 되돌림(decision-log 참고). paddingTop은
          height 고정 없이 insets.top+8로만 계산 — 예전에 height:40을 같이 줬다가 상태바 높이만큼의
          paddingTop이 그 고정 높이를 깎아먹어 잘리는 버그가 있었음(2026-09-07 발견/수정, 이 구조는 유지) */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onExit} hitSlop={8} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {photos.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setActivePhoto(Math.round(e.nativeEvent.contentOffset.x / HERO_IMAGE_WIDTH))
              }
            >
              {photos.map((url, idx) => (
                <View key={idx} style={styles.heroPage}>
                  <Image source={{ uri: url }} style={styles.heroImage} resizeMode="cover" />
                </View>
              ))}
            </ScrollView>
            {photos.length > 1 && (
              <View style={styles.dotRow}>
                {photos.map((_, idx) => (
                  <View key={idx} style={[styles.dot, idx === activePhoto && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.heroPage}>
            <View style={[styles.heroImage, styles.heroImagePlaceholder]} />
          </View>
        )}

        <View style={styles.titleRow}>
          <Text style={styles.placeName}>{place.name}</Text>
          {/* Figma는 하트 밑에 좋아요 수(587)를 보여주는데 place_like엔 개수 API가 없음 — 대신
              실제로 있는 방문 기록 수(visit_log_count)를 같은 자리에 넣음(가짜 숫자 아님) */}
          <TouchableOpacity onPress={toggleLike} disabled={likeBusy} hitSlop={8} style={styles.likeButton}>
            <Text style={styles.likeIcon}>{place.is_liked ? '♥' : '♡'}</Text>
            <Text style={styles.likeCount}>{place.visit_log_count}</Text>
          </TouchableOpacity>
        </View>

        {chips.length > 0 && (
          <View style={styles.chipRow}>
            {chips.map((chip) => (
              <View key={chip} style={styles.chip}>
                <Text style={styles.chipText}>{chip}</Text>
              </View>
            ))}
          </View>
        )}

        {place.overview && <Text style={styles.overview}>{place.overview}</Text>}

        {place.avg_rating != null && (
          <View style={styles.avgRatingRow}>
            <StarRating rating={place.avg_rating} size={16} />
            <Text style={styles.avgRatingValue}>{place.avg_rating.toFixed(1)}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>기본정보</Text>

          {place.lat != null && place.lng != null && (
            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.previewMap}
              scrollEnabled={false}
              zoomEnabled={false}
              pointerEvents="none"
              initialRegion={{
                latitude: place.lat,
                longitude: place.lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <Marker coordinate={{ latitude: place.lat, longitude: place.lng }} />
            </MapView>
          )}

          <View style={styles.infoList}>
            {place.addr1 && <InfoRow label="주소" value={[place.addr1, place.addr2].filter(Boolean).join(' ')} />}
            {place.tel && <InfoRow label="전화번호" value={place.tel} />}
            {place.homepage && <InfoRow label="홈페이지" value={place.homepage} />}
            {hoursLines.length > 0 && <InfoRow label="영업 시간" value={hoursLines.join('\n')} />}
          </View>
        </View>

        <View style={styles.section}>
          {/* "기록 남기기"는 메인 페이지에서만 하는 걸로 정리 — 이 화면에서는 안 만듦(2026-09-07 결정) */}
          <Text style={styles.sectionTitle}>리뷰 {logs ? logs.meta.total : ''}</Text>

          {logs && logs.logs.length === 0 && <Text style={styles.emptyText}>아직 방문 기록이 없어요</Text>}

          {/* Figma(458:2474)는 사진 위주 2열 그리드(사진+그라데이션+작성자 아바타·이름+한줄리뷰
              오버레이)로 재설계됐는데, 장소별 방문기록 목록(PlaceLogsResponse.VisitLogSummary)엔
              작성자 정보 자체가 없음(explore.similarLogs만 작성자를 내려줌, api/visitLog.ts 참고)
              — 아바타·이름은 없는 데이터라 생략하고, 실제로 있는 필드(대표 사진+한줄리뷰)만으로
              같은 그리드 레이아웃을 재구성(2026-09-07 정정). 사진 없는 리뷰는 텍스트만 있는 타일로 */}
          <View style={styles.reviewGrid}>
            {logs?.logs.map((log) => (
              <View key={log.id} style={styles.reviewTile}>
                {log.photos[0] ? (
                  <Image source={{ uri: log.photos[0].url }} style={styles.reviewTileImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.reviewTileImage, styles.reviewTilePlaceholder]} />
                )}
                <LinearGradient colors={['#00000000', '#111111cc']} style={styles.reviewTileGradient} pointerEvents="none" />
                <View style={styles.reviewTileOverlay}>
                  {log.rating != null && <StarRating rating={log.rating} size={11} />}
                  {log.one_line && (
                    <Text style={styles.reviewTileText} numberOfLines={3}>
                      {log.one_line}
                    </Text>
                  )}
                  <Text style={styles.reviewTileDate}>{formatVisitMonth(log.visited_at)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  // 뒤로가기만 있는 헤더 — 아이콘(24) 기준 위아래 8씩 패딩(고정 height 안 씀, 위 주석 참고)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
    backgroundColor: colors.white,
  },
  backButton: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 20, color: colors.black },
  content: { paddingBottom: 40 },
  // Figma 실측(458:2474 "Group 1707481350"): 사진 자체는 320폭(팬널 360 안에서 좌우 20씩 여백),
  // 화면 꽉 채우는 게 아님 — 그런데 가로 스크롤 pagingEnabled는 컨테이너(=페이지 폭) 단위로 스냅해서
  // 페이지 폭을 320으로 하면(HERO_PAGE_WIDTH 참고) 이미지 자체 폭은 그보다 좁은 HERO_IMAGE_WIDTH를
  // 따로 둬서 각 페이지 안에서 사진만 중앙에 배치(paddingHorizontal)하는 식으로 여백을 재현
  heroPage: { width: HERO_IMAGE_WIDTH, paddingHorizontal: 20 },
  heroImage: { width: '100%', height: 234, borderRadius: 20 },
  heroImagePlaceholder: { backgroundColor: colors.border },
  dotRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: -24, marginBottom: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: colors.white },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 16,
  },
  placeName: { flex: 1, fontFamily: fonts.semiBold, fontSize: 20, letterSpacing: -0.5, color: colors.black },
  likeButton: { alignItems: 'center', paddingLeft: 12 },
  likeIcon: { fontSize: 24, color: colors.black },
  likeCount: { fontFamily: fonts.regular, fontSize: 11, color: colors.gray500, marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginTop: 16 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
    backgroundColor: colors.backgroundMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { fontFamily: fonts.regular, fontSize: 12, letterSpacing: -0.3, color: colors.black },
  overview: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19.6,
    letterSpacing: -0.35,
    color: colors.black,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  avgRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  avgRatingValue: { fontFamily: fonts.medium, fontSize: 13, color: colors.gray700 },
  section: { marginTop: 32, paddingHorizontal: 20 },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: 20, letterSpacing: -0.5, color: colors.black, marginBottom: 16 },
  previewMap: { width: '100%', height: 160, borderRadius: 8, marginBottom: 16 },
  infoList: { gap: 12 },
  infoRow: { flexDirection: 'row' },
  infoLabel: { width: 64, fontFamily: fonts.medium, fontSize: 12, letterSpacing: -0.3, color: colors.black },
  infoValue: { flex: 1, fontFamily: fonts.regular, fontSize: 12, letterSpacing: -0.3, lineHeight: 17, color: colors.gray500 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.gray500 },
  // Figma 실측(458:2474 "Frame 2147227174" 등): 2열 그리드, 열 간격/행 간격 둘 다 8
  reviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: REVIEW_GRID_GAP },
  reviewTile: {
    width: REVIEW_TILE_WIDTH,
    height: REVIEW_TILE_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.backgroundMuted,
  },
  reviewTileImage: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  reviewTilePlaceholder: { backgroundColor: colors.border },
  // Figma 그라데이션 스톱 그대로(투명→#111111, opacity 0.8) — 사진 위에 텍스트가 얹혀도 읽히게
  reviewTileGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' },
  reviewTileOverlay: { position: 'absolute', left: 10, right: 10, bottom: 10, gap: 4 },
  // Figma는 이 자리에 작성자 이름도 같이 오는데(흰색, Medium) 이 데이터 소스엔 작성자 정보가 없어서
  // 생략 — 한줄리뷰 텍스트만 표시. Figma 원문 폰트는 Light(300)인데 앱은 4종(Regular/Medium/
  // SemiBold/Bold)만 번들해서 Regular로 대체(2026-08-31 기존 결정 재사용)
  reviewTileText: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 14, letterSpacing: -0.2, color: '#ffffff' },
  reviewTileDate: { fontFamily: fonts.regular, fontSize: 10, color: '#ffffffcc' },
});
