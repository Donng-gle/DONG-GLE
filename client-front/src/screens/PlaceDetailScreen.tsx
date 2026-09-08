import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
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
import { PlaceLogsResponse, VisitLogSummary, visitLogApi } from '../api/visitLog';
import { BookmarkIcon, SearchIcon } from '../components/icons';
import { StarRating } from '../components/StarRating';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { SearchScreen } from './SearchScreen';

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

// 리뷰 카드 사진 콜라주 치수 — Figma 실측(354:1345 "Group 1707481351"): 320폭 카드 안에서
// 큰 사진 216x204 + 작은 사진(100x100) 2장을 오른쪽에 4 간격으로 쌓음. 카드 자체 폭이 기기
// 폭마다 달라질 수 있어서(REVIEW_CARD_PADDING 뺀 값 기준) 비율로 환산
const REVIEW_COLLAGE_GAP = 4;
const REVIEW_CARD_PADDING = 16;
const REVIEW_COLLAGE_WIDTH = HERO_IMAGE_WIDTH - 40 - REVIEW_CARD_PADDING * 2; // 화면 좌우 20 + 카드 패딩 16씩
const REVIEW_COLLAGE_BIG_WIDTH = REVIEW_COLLAGE_WIDTH * (216 / 320);
const REVIEW_COLLAGE_SMALL_WIDTH = REVIEW_COLLAGE_WIDTH - REVIEW_COLLAGE_BIG_WIDTH - REVIEW_COLLAGE_GAP;
const REVIEW_COLLAGE_HEIGHT = REVIEW_COLLAGE_BIG_WIDTH * (204 / 216);

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

// Figma 노드 354:1345/458:2474/358:5134("관광지 상세 페이지") 중 354:1345를 기준으로 재실측
// (2026-09-09, 채널 i1yleec3). "가는 방법"은 여전히 대응하는 백엔드 데이터가 없어서 생략(TourAPI에
// 그런 필드 자체가 없음) — 없는 데이터를 지어내지 않기 위한 선택 (2026-09-01 결정, decision-log
// 참고). 별점(avg_rating)은 이미 있음. 헤더 돋보기/북마크는 2026-09-07에 한 번 추가했다가 뒤로가기만
// 남기는 걸로 되돌렸었는데, 2026-09-09 새 시안(354:1345)에 다시 있어서 사용자 확인 후 재추가함.
// 리뷰 카드도 작성자 프로필(닉네임/아바타, 2026-09-09 백엔드에 VisitLogSummary.nickname/
// profile_image_url 추가)+별점+글+사진 카드형으로 전면 교체(사진 그리드+텍스트 오버레이였던
// 이전 458:2474 버전은 폐기)
export function PlaceDetailScreen({ placeId, onExit }: Props) {
  const insets = useSafeAreaInsets();
  const [place, setPlace] = useState<PlaceDetail | null>(null);
  const [logs, setLogs] = useState<PlaceLogsResponse | null>(null);
  const [likeBusy, setLikeBusy] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);
  const [searchVisible, setSearchVisible] = useState(false);

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

      {/* 뒤로가기+돋보기+북마크 — 2026-09-09 재실측(354:1345)으로 돋보기/북마크 재추가(사용자 확인
          받음, decision-log 참고). 돋보기는 HomeScreen과 동일한 패턴(SearchScreen을 투명 Modal로
          띄움)을 이 화면 안에서 자체적으로 처리 — PlaceDetailScreen은 5곳에서 렌더되는데 그 부모들을
          다 건드리지 않아도 되게 self-contained로 둠. 북마크는 기존 찜 토글(toggleLike)을 그대로 씀,
          채워진 정도로 is_liked 상태 표시. paddingTop은 height 고정 없이 insets.top+8로만 계산 —
          예전에 height:40을 같이 줬다가 상태바 높이만큼의 paddingTop이 그 고정 높이를 깎아먹어
          잘리는 버그가 있었음(2026-09-07 발견/수정, 이 구조는 유지) */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onExit} hitSlop={8} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => setSearchVisible(true)} hitSlop={8} style={styles.headerIconButton}>
            <SearchIcon size={20} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleLike} disabled={likeBusy} hitSlop={8} style={styles.headerIconButton}>
            <BookmarkIcon size={22} filled={!!place.is_liked} />
          </TouchableOpacity>
        </View>
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
                  <View style={styles.heroImageWrap}>
                    <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.2)']} style={StyleSheet.absoluteFill} pointerEvents="none" />
                  </View>
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
            <View style={[styles.heroImageWrap, styles.heroImagePlaceholder]} />
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

          {/* 2026-09-09 재실측(354:1345)으로 사진 그리드+텍스트 오버레이(458:2474 기준) 대신 프로필
              (아바타+닉네임+방문월)+별점 헤더, 그 아래 리뷰 본문, 사진이 있으면 그 아래 콜라주를
              보여주는 카드형으로 전면 교체. 작성자 정보는 백엔드에 새로 추가한
              VisitLogSummary.nickname/profile_image_url을 씀(explore.similarLogs와 동일 패턴,
              2026-09-09 결정, decision-log 참고). 좋아요/댓글 수는 이 기록에 대응하는 백엔드
              데이터가 없어서(그런 기능 자체가 없음) 계속 생략 */}
          {logs?.logs.map((log) => (
            <ReviewCard key={log.id} log={log} />
          ))}
        </View>
      </ScrollView>

      <Modal visible={searchVisible} transparent animationType="none" onRequestClose={() => setSearchVisible(false)}>
        <SearchScreen onExit={() => setSearchVisible(false)} />
      </Modal>
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

// Figma 실측(354:1345 "Frame 2147227140"): 프로필(아바타40+닉네임+방문월, 우측에 별점)→본문→
// (있으면) 사진 콜라주. 사진 1장이면 꽉 채운 한 장, 2장 이상이면 큰 사진 하나+작은 사진 최대 2장을
// 오른쪽에 쌓는 콜라주로(Figma "Group 1707481351" 그대로) — 3장 넘는 사진은 이 카드에선 앞 3장만
function ReviewCard({ log }: { log: VisitLogSummary }) {
  const photos = log.photos;
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewCardHeader}>
        <View style={styles.reviewProfileRow}>
          {log.profile_image_url ? (
            <Image source={{ uri: log.profile_image_url }} style={styles.reviewAvatar} />
          ) : (
            <View style={[styles.reviewAvatar, styles.reviewAvatarPlaceholder]} />
          )}
          <View>
            <Text style={styles.reviewNickname}>{log.nickname}</Text>
            <Text style={styles.reviewVisitMonth}>{formatVisitMonth(log.visited_at)}</Text>
          </View>
        </View>
        {log.rating != null && (
          <View style={styles.reviewRatingRow}>
            <StarRating rating={log.rating} size={16} />
            <Text style={styles.reviewRatingValue}>{log.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>

      {log.one_line && <Text style={styles.reviewBody}>{log.one_line}</Text>}

      {photos.length === 1 && (
        <Image source={{ uri: photos[0].url }} style={styles.reviewSinglePhoto} resizeMode="cover" />
      )}
      {photos.length >= 2 && (
        <View style={styles.reviewCollageRow}>
          <Image source={{ uri: photos[0].url }} style={styles.reviewCollageBig} resizeMode="cover" />
          <View style={styles.reviewCollageSmallCol}>
            {photos.slice(1, 3).map((p, i) => (
              <Image key={i} source={{ uri: p.url }} style={styles.reviewCollageSmall} resizeMode="cover" />
            ))}
          </View>
        </View>
      )}
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
    backgroundColor: colors.white,
  },
  backButton: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 20, color: colors.black },
  // Figma 실측(354:1345 "Frame 1707481424"): 아이콘 2개 사이 간격16
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerIconButton: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  // gap12 — 헤더 아래 히어로 사진까지의 여백(2026-09-09 재실측)
  content: { paddingBottom: 40, paddingTop: 12 },
  // Figma 실측(354:1345 "Group 1707481350"): 사진 자체는 320폭(팬널 360 안에서 좌우 20씩 여백),
  // 화면 꽉 채우는 게 아님 — 그런데 가로 스크롤 pagingEnabled는 컨테이너(=페이지 폭) 단위로 스냅해서
  // 페이지 폭을 320으로 하면(HERO_PAGE_WIDTH 참고) 이미지 자체 폭은 그보다 좁은 HERO_IMAGE_WIDTH를
  // 따로 둬서 각 페이지 안에서 사진만 중앙에 배치(paddingHorizontal)하는 식으로 여백을 재현
  heroPage: { width: HERO_IMAGE_WIDTH, paddingHorizontal: 20 },
  // 그라디언트(투명->검정20%)를 이미지 위에 정확히 겹치려고 이미지+그라디언트를 이 wrap 안에서
  // absoluteFill로 얹음(2026-09-09 추가) — heroPage의 paddingHorizontal 때문에 absolute 자식을
  // heroPage에 바로 두면 패딩을 무시하고 어긋나서 이 wrap을 한 겹 더 둠
  heroImageWrap: { width: '100%', height: 234, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.border },
  heroImagePlaceholder: { backgroundColor: colors.border },
  // 2026-09-09 재실측: 점 크기 6->8, 비활성 투명도 0.5->0.4
  dotRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: -24, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: colors.white },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 16,
  },
  placeName: { flex: 1, fontFamily: fonts.semiBold, fontSize: 20, letterSpacing: -0.5, lineHeight: 29, color: colors.black },
  likeButton: { alignItems: 'center', paddingLeft: 12 },
  likeIcon: { fontSize: 24, color: colors.black },
  // 2026-09-09 재실측: 11->12, gray500->gray700
  likeCount: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray700, marginTop: 2 },
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
    marginTop: 16,
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
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: 20, letterSpacing: -0.5, color: colors.black, marginBottom: 12 },
  previewMap: { width: '100%', height: 183, borderRadius: 8, marginBottom: 12 },
  infoList: { gap: 8 },
  infoRow: { flexDirection: 'row' },
  infoLabel: { width: 64, fontFamily: fonts.medium, fontSize: 12, letterSpacing: -0.3, color: colors.black },
  // 2026-09-09 재실측: gray500->gray700
  infoValue: { flex: 1, fontFamily: fonts.regular, fontSize: 12, letterSpacing: -0.3, lineHeight: 17, color: colors.gray700 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.gray500 },
  // Figma 실측(354:1345 "Frame 2147227140"): 흰 카드+테두리(그림자/배경색 없음). 카드 안쪽
  // 패딩은 실측 좌표상 0에 가까웠지만(자식 x좌표가 카드 x좌표와 거의 같음) 글/사진이 테두리에
  // 바로 붙어 답답해 보여서 여유 있게 16으로 둠(2026-09-09, StreetTab 카드와 같은 판단)
  reviewCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: REVIEW_CARD_PADDING,
    marginBottom: 16,
  },
  reviewCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  reviewProfileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  reviewAvatar: { width: 40, height: 40, borderRadius: 8 },
  reviewAvatarPlaceholder: { backgroundColor: colors.border },
  reviewNickname: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.black },
  reviewVisitMonth: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray700, marginTop: 2 },
  reviewRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewRatingValue: { fontFamily: fonts.regular, fontSize: 14, color: colors.black },
  reviewBody: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.4,
    color: colors.black,
    marginTop: 16,
  },
  reviewSinglePhoto: {
    width: '100%',
    aspectRatio: REVIEW_COLLAGE_WIDTH / REVIEW_COLLAGE_HEIGHT,
    borderRadius: 4,
    marginTop: 8,
    backgroundColor: colors.backgroundMuted,
  },
  reviewCollageRow: { flexDirection: 'row', gap: REVIEW_COLLAGE_GAP, marginTop: 8 },
  reviewCollageBig: {
    width: REVIEW_COLLAGE_BIG_WIDTH,
    height: REVIEW_COLLAGE_HEIGHT,
    borderRadius: 4,
    backgroundColor: colors.backgroundMuted,
  },
  reviewCollageSmallCol: { gap: REVIEW_COLLAGE_GAP },
  reviewCollageSmall: {
    width: REVIEW_COLLAGE_SMALL_WIDTH,
    height: (REVIEW_COLLAGE_HEIGHT - REVIEW_COLLAGE_GAP) / 2,
    borderRadius: 4,
    backgroundColor: colors.backgroundMuted,
  },
});
