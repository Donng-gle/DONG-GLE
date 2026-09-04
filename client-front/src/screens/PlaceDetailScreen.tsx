import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlaceDetail, placeApi } from '../api/place';
import { PlaceLogsResponse, visitLogApi } from '../api/visitLog';
import { StarRating } from '../components/StarRating';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { VisitLogCreateScreen } from './VisitLogCreateScreen';

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

// Figma 노드 354:1345/458:2474/358:5134("관광지 상세 페이지", 셋 다 동일 화면) 반영. 작성자
// 프로필/좋아요·댓글 수/"가는 방법"은 대응하는 백엔드 데이터가 없어서 여전히 생략(place_like엔
// 개수가 아니라 내 찜 여부만 있음) — 없는 데이터를 지어내지 않기 위한 선택 (2026-09-01 결정,
// decision-log 참고). 2026-09-05 재검토: 헤더 타이틀 제거(원본은 사진 아래 title row에서만
// 이름을 보여줌), 하트 옆 좋아요 수 자리에 실존 필드인 visit_log_count를 넣음, 리뷰 사진을
// 텍스트 위 큰 히어로 이미지 대신 텍스트 아래 작은 썸네일로 옮기고 날짜를 "OOOO년 O월 여행"
// 표기로 맞춤. 별점(rating/avg_rating)은 2026-09-05에 백엔드에 새로 추가돼서 더 이상 생략 대상이
// 아님 — overview 아래 평균 별점, 리뷰 카드마다 개별 별점(있는 경우만) 표시
export function PlaceDetailScreen({ placeId, onExit }: Props) {
  const insets = useSafeAreaInsets();
  const [place, setPlace] = useState<PlaceDetail | null>(null);
  const [logs, setLogs] = useState<PlaceLogsResponse | null>(null);
  const [likeBusy, setLikeBusy] = useState(false);
  const [showCreateLog, setShowCreateLog] = useState(false);
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

  if (showCreateLog && place) {
    return (
      <VisitLogCreateScreen
        placeId={place.id}
        placeName={place.name}
        onDone={() => {
          setShowCreateLog(false);
          load();
        }}
        onCancel={() => setShowCreateLog(false)}
      />
    );
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

      {/* Figma엔 헤더에 이름이 없음(사진 아래 title row에서 크게 한 번만 보여줌) — 뒤로가기 버튼만
          두는 게 오히려 원본과 더 가까움. 검색/프로필 아이콘도 있긴 한데 이 화면은 여러 곳(안동 거리
          탭, 검색 화면, 스크랩북 등)에서 열려서 어디로 보낼지 애매해 장식용 버튼을 억지로 만드는
          대신 뺐음(2026-09-05 결정, decision-log 참고) */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
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
                <Image key={idx} source={{ uri: url }} style={styles.heroImage} resizeMode="cover" />
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
          <View style={[styles.heroImage, styles.heroImagePlaceholder]} />
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
          <View style={styles.reviewHeaderRow}>
            <Text style={styles.sectionTitle}>리뷰 {logs ? logs.meta.total : ''}</Text>
            <TouchableOpacity onPress={() => setShowCreateLog(true)}>
              <Text style={styles.reviewWriteLink}>기록 남기기 +</Text>
            </TouchableOpacity>
          </View>

          {logs && logs.logs.length === 0 && <Text style={styles.emptyText}>아직 방문 기록이 없어요</Text>}

          {/* Figma는 작성자 아바타+이름+좋아요/댓글 수까지 보여주는데, 장소별 방문기록 목록
              (PlaceLogsResponse.VisitLogSummary)엔 작성자 정보 자체가 없고 좋아요/댓글 개수도
              없음(explore.similarLogs만 작성자를 내려줌, api/visitLog.ts 참고) — 실제로 있는 필드
              (사진 1장·한줄리뷰·별점·태그·방문월)만으로 재구성. 사진도 원본은 히어로 크기였는데
              Figma 쪽은 리뷰 텍스트 아래 작은 썸네일이라 그 순서/크기로 맞춤 */}
          {logs?.logs.map((log) => (
            <View key={log.id} style={styles.reviewCard}>
              {log.rating != null && <StarRating rating={log.rating} size={13} />}
              {log.one_line && <Text style={styles.reviewText}>{log.one_line}</Text>}
              {log.photo_url && <Image source={{ uri: log.photo_url }} style={styles.reviewThumb} resizeMode="cover" />}
              <View style={styles.reviewFooterRow}>
                {log.tags.length > 0 && <Text style={styles.reviewTags}>{log.tags.join(' · ')}</Text>}
                <Text style={styles.reviewDate}>{formatVisitMonth(log.visited_at)}</Text>
              </View>
            </View>
          ))}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: colors.white,
  },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 20, color: colors.black },
  content: { paddingBottom: 40 },
  heroImage: { width: HERO_IMAGE_WIDTH, height: 234, borderRadius: 20 },
  heroImagePlaceholder: { width: '100%', backgroundColor: colors.border, marginHorizontal: 20 },
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
  reviewHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  reviewWriteLink: { fontFamily: fonts.medium, fontSize: 13, letterSpacing: -0.3, color: colors.gray700, marginBottom: 16 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.gray500 },
  reviewCard: { paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.divider },
  // Figma는 텍스트 아래 작은 사진 썸네일들이 옴(리뷰당 여러 장) — VisitLogSummary는 사진 1장뿐이라
  // 그 1장을 같은 자리·같은 크기감으로 배치
  reviewThumb: { width: 96, height: 96, borderRadius: 12, marginTop: 12 },
  reviewText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.black, marginTop: 6 },
  reviewFooterRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  reviewTags: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray500 },
  reviewDate: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray500 },
});
