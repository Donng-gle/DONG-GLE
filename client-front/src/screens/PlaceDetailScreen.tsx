import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
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
import { BookmarkIcon, HeartIcon, SearchIcon } from '../components/icons';
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

// 리뷰 포토 그리드 치수 — Figma 실측(458:2474 "리뷰" 섹션, 602:15528 카드 등, 2026-09-09 재실측,
// 채널 vvw77yh5): 2열 그리드, 카드 156x216(비율 216/156), 열/행 간격 모두 8. 화면 좌우 패딩(20씩)
// 뺀 폭을 기기 폭에 맞춰 비율로 환산
const REVIEW_GRID_GAP = 8;
const REVIEW_GRID_ITEM_WIDTH = (HERO_IMAGE_WIDTH - 40 - REVIEW_GRID_GAP) / 2;
const REVIEW_GRID_ITEM_HEIGHT = REVIEW_GRID_ITEM_WIDTH * (216 / 156);

function formatHours(hours: PlaceDetail['hours']) {
  return hours.map((h) => {
    const open = `${WEEKDAY_LABELS[h.open_day]} ${h.open_time.slice(0, 5)}`;
    if (h.close_time == null) return `${open} ~ 24시간`;
    const closeDayLabel = h.close_day != null && h.close_day !== h.open_day ? `${WEEKDAY_LABELS[h.close_day]} ` : '';
    return `${open} ~ ${closeDayLabel}${h.close_time.slice(0, 5)}`;
  });
}

// Figma 노드 354:1345/458:2474/358:5134("관광지 상세 페이지") 재실측(2026-09-09, 채널 vvw77yh5,
// 같은 날 앞선 세션의 i1yleec3 실측을 이어받아 정정). "가는 방법"은 여전히 대응하는 백엔드 데이터가
// 없어서 생략(TourAPI에 그런 필드 자체가 없음) — 없는 데이터를 지어내지 않기 위한 선택(2026-09-01
// 결정, decision-log 참고). 별점(avg_rating)은 이미 있음.
//
// 이번 세션 변경 4가지(전부 사용자 확인):
// 1) 이름-태그칩 간격: chipRow marginTop을 16 그대로 뒀었는데, titleRow가 하트+개수 컬럼(~41 높이)
//    때문에 이름 텍스트 한 줄(29 높이)보다 실제로 더 큰 높이를 차지해서 marginTop이 그 위에 또
//    쌓여 체감 간격이 Figma 실측치보다 훨씬 컸음 — marginTop 16→8로 축소
// 2) 이름 옆 하트: 유니코드 글리프(♥/♡) 대신 Figma 벡터에 맞춘 HeartIcon(components/icons.tsx)으로
//    교체
// 3) "소개"(히어로+이름+칩+개요+평점)/"기본정보"/"리뷰" 세 블록 사이 경계 — Figma엔 테두리선이
//    아니라 페이지 배경을 옅은 회색(#f1f1f5, colors.rowDivider)으로 깔고 각 블록을 흰 배경 풀블리드
//    카드로 얹어 12 간격으로 띄우는 방식이었음(354:1345 "콘텐츠"/"리뷰" 프레임 실측) — 지금까지는
//    화면 전체가 흰 배경 하나라 블록 구분이 아예 안 보였던 것. topCard/section 스타일에 흰 배경+
//    marginTop 12 추가, container 배경을 rowDivider로 변경
// 4) 기본정보 지도: 183 높이/8 radius였던 걸 사용자 요청으로 확대+더 둥글게(220/16) — Figma엔
//    이 크기의 변형이 없어서(세 프레임 다 320x183/radius8 동일) 임의 조정
//
// 리뷰 카드는 지난 세션(같은 날 앞선 대화)에 458:2474의 사진 그리드+텍스트 오버레이 디자인을
// "옛날 시안"으로 보고 354:1345의 아바타+닉네임+별점+본문 카드형으로 이미 한 번 바꿨었는데, 이번
// 세션에 사용자가 그 판단을 뒤집어 "사진이 더 메인인" 458:2474 스타일(사진 위 하단 그라디언트+
// 아바타/닉네임/본문 오버레이, 2열 그리드)로 다시 교체해달라고 명시적으로 요청함 — 458:2474
// "리뷰" 섹션(602:15528 카드 등) 실측대로 재구현, 354:1345의 아바타+별점 카드 버전은 폐기.
// 별점은 이 그리드 디자인엔 아예 표시 자리가 없어서(Figma 실측 확인) 생략 — 데이터 자체는
// VisitLogSummary.rating에 남아있으니 추후 디자인이 다시 바뀌면 복원 가능
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
      // like_count는 서버가 토글 직후 다시 센 최신값을 그대로 내려줌(낙관적으로 +-1 안 함 —
      // 2026-09-12, api/place.ts LikeResponse 참고)
      setPlace({ ...place, is_liked: result.is_liked, like_count: result.like_count });
    } catch (e) {
      Alert.alert('찜 처리에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLikeBusy(false);
    }
  }

  // 기본정보의 지도 미리보기는 pointerEvents="none"이라 그 자체론 이동/줌이 안 됨(의도적 — 아래
  // openInGoogleMaps 코멘트 참고) — 대신 탭하면 구글맵 앱(설치 안 돼있으면 브라우저)의 길찾기로
  // 넘김. 미리보기 박스 안에서 직접 팬/핀치되게 하는 방안도 검토했는데, 이 박스가 ScrollView 안에
  // 있어서 지도가 제스처를 가로채면 페이지 스크롤이 막히는 흔한 문제가 있고, 인앱에 별도 큰 지도
  // 화면을 새로 만드는 방안도 검토했지만 사용자가 실제로 원하는 길찾기/실시간 교통정보는 결국
  // 구글맵 고유 기능이라 그대로 넘기는 쪽이 공수 대비 효용이 제일 좋다고 판단(2026-09-09 사용자와
  // 논의 후 결정)
  // destination에 이름을 넘기면 구글맵이 그 이름으로 재검색해서 목적지를 잡음 — 좌표만 넘길 때
  // 핀 라벨이 "위도, 경도" 숫자로만 뜨던 걸 실제 장소명("월영교" 등)으로 보여주기 위함(2026-09-09
  // 사용자 요청). 흔한 이름이면 엉뚱한 곳이 잡힐 이론적 위험은 있지만, TourAPI 관광지 목록은 대부분
  // 고유한 이름이라 실사용 리스크는 낮다고 판단 — name이 없으면 기존대로 좌표로 폴백
  async function openInGoogleMaps(lat: number, lng: number, name?: string) {
    const destination = name ? encodeURIComponent(name) : `${lat},${lng}`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    try {
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('지도 앱을 열지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
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

      {/* 이 화면을 여는 부모(StreetTab/RecommendedTab)가 HomeScreen의 tabContent 안에 있고,
          HomeScreen은 그 뒤에 FloatingNav(position:absolute, 화면 하단에 항상 떠 있는 바)를
          형제로 렌더함 — 이 화면을 꽉 채워 렌더해도 FloatingNav는 그 위에 계속 겹쳐 보임. 끝까지
          스크롤했을 때 마지막 리뷰 하단 텍스트가 그 바에 가려 안 읽히는 문제(2026-09-09 사용자
          리포트) — FloatingNav.tsx와 같은 공식(바 자체의 화면 하단 오프셋 Math.max(20,
          insets.bottom+12) + 중앙 버튼이 위로 튀어나온 높이까지 포함한 바 전체 높이 66)만큼 여유를
          더 주고, 바로 위에 딱 붙지 않게 20 여백을 추가로 둠 */}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(20, insets.bottom + 12) + 66 + 20 }]}>
        {/* "소개" 블록(히어로+이름+칩+개요+평점) — 흰 풀블리드 카드로 묶어서 회색 페이지 배경(container)
            위에 얹음. 기본정보/리뷰 카드와 marginTop 12로 같은 간격을 둠(위 코멘트 3번 참고) */}
        <View style={styles.topCard}>
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
            {/* Figma는 하트 밑에 실제 좋아요(찜) 수(587)를 보여줌 — 예전엔 place_like 개수 API가
                없어서 방문 기록 수(visit_log_count)를 대신 넣어뒀었는데, 그래서 하트를 눌러도 숫자가
                전혀 안 바뀌는 버그였음(2026-09-12, 사용자 리포트). 백엔드에 like_count 추가해서 정정 */}
            <TouchableOpacity onPress={toggleLike} disabled={likeBusy} hitSlop={8} style={styles.likeButton}>
              <HeartIcon size={24} filled={!!place.is_liked} />
              <Text style={styles.likeCount}>{place.like_count}</Text>
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
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>기본정보</Text>

          {place.lat != null && place.lng != null && (
            // MapView 자체에 borderRadius를 줘도 안드로이드 네이티브 지도 뷰는 그걸 무시하고 각진
            // 사각형 그대로 그림(RN 네이티브 컴포넌트 공통 이슈) — overflow:hidden인 감싸는 View로
            // 잘라내는 방식으로 우회(2026-09-09, 사용자가 "테두리가 각지다"고 리포트해서 발견).
            // 탭하면 구글맵 앱 길찾기로 연결(openInGoogleMaps 코멘트 참고) — MapView는 여전히
            // pointerEvents="none"으로 둬서 탭이 이 TouchableOpacity로 그대로 전달되게 함
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.previewMapWrap}
              onPress={() => openInGoogleMaps(place.lat!, place.lng!, place.name)}
            >
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
            </TouchableOpacity>
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

          {/* 458:2474 "리뷰" 섹션 실측대로 사진이 메인인 2열 그리드로 교체(위 코멘트 참고). 작성자
              정보는 백엔드 VisitLogSummary.nickname/profile_image_url을 씀(explore.similarLogs와
              동일 패턴) */}
          {logs && logs.logs.length > 0 && (
            <View style={styles.reviewGrid}>
              {logs.logs.map((log) => (
                <PhotoReviewCard key={log.id} log={log} />
              ))}
            </View>
          )}
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

// Figma 실측(458:2474 "리뷰" 섹션, 602:15528 카드): 156x216(비율 216/156) 카드, 사진을 배경 전체에
// 깔고 하단 절반에 투명→#111 그라디언트(opacity 0.8)를 얹어 그 위에 아바타16+닉네임(12 medium
// 흰색), 그 아래 본문(8 regular #cccccc, 최대 2줄)을 오버레이. 사진이 없는 기록은 이 디자인이
// 애초에 상정하지 않는 상태라(Figma에 그런 변형이 없음) 사진 없이도 카드 자체는 그리되, 어두운
// 사진 배경이 없으니 텍스트를 흰색 대신 검정 계열로 바꿔 가독성만 확보(문의 대비 목적, 레이아웃은
// 동일). 별점은 이 디자인엔 없어서 생략(위 파일 상단 코멘트 참고)
function PhotoReviewCard({ log }: { log: VisitLogSummary }) {
  const photo = log.photos[0];
  return (
    <View style={styles.gridCard}>
      {photo ? (
        <>
          <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(17,17,17,0.8)']}
            locations={[0.5, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.gridCardPlaceholder]} />
      )}

      <View style={styles.gridCardProfile}>
        <View style={styles.gridCardProfileRow}>
          {log.profile_image_url ? (
            <Image source={{ uri: log.profile_image_url }} style={styles.gridCardAvatar} />
          ) : (
            <View style={[styles.gridCardAvatar, styles.gridCardAvatarPlaceholder]} />
          )}
          <Text style={[styles.gridCardNickname, !photo && styles.gridCardTextOnLight]} numberOfLines={1}>
            {log.nickname}
          </Text>
        </View>
        {log.one_line && (
          <Text style={[styles.gridCardBody, !photo && styles.gridCardBodyOnLight]} numberOfLines={2}>
            {log.one_line}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Figma 실측(354:1345): 페이지 배경은 옅은 회색(rowDivider, PlaceMapPickerScreen의 구분선과 같은
  // 값이라 재사용)이고 그 위에 흰 카드(topCard/section)를 얹어 카드 사이 회색 여백으로 섹션 경계를
  // 표현함 — 지금까지는 이 값이 없어서(흰 배경 하나) "소개"/"기본정보"/"리뷰" 사이 경계가 전혀
  // 안 보였음(2026-09-09, 사용자 리포트로 발견)
  container: { flex: 1, backgroundColor: colors.rowDivider },
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
  content: { paddingBottom: 40 },
  // "소개" 카드 — 흰 풀블리드 배경(회색 페이지 위, 위 container 코멘트 참고). paddingTop12는 헤더
  // 아래 히어로 사진까지의 여백(기존 content.paddingTop 그대로 이 카드 안으로 옮김)
  topCard: { backgroundColor: colors.white, paddingTop: 12, paddingBottom: 20 },
  // Figma 실측(354:1345 "Group 1707481350"): 사진 자체는 320폭(팬널 360 안에서 좌우 20씩 여백),
  // 화면 꽉 채우는 게 아님 — 그런데 가로 스크롤 pagingEnabled는 컨테이너(=페이지 폭) 단위로 스냅해서
  // 페이지 폭을 320으로 하면(HERO_PAGE_WIDTH 참고) 이미지 자체 폭은 그보다 좁은 HERO_IMAGE_WIDTH를
  // 따로 둬서 각 페이지 안에서 사진만 중앙에 배치(paddingHorizontal)하는 식으로 여백을 재현
  heroPage: { width: HERO_IMAGE_WIDTH, paddingHorizontal: 20 },
  // 그라디언트(투명->검정20%)를 이미지 위에 정확히 겹치려고 이미지+그라디언트를 이 wrap 안에서
  // absoluteFill로 얹음(2026-09-09 추가) — heroPage의 paddingHorizontal 때문에 absolute 자식을
  // heroPage에 바로 두면 패딩을 무시하고 어긋나서 이 wrap을 한 겹 더 둠.
  // height를 Figma 실측값(234)으로 고정해뒀었는데, 실기기 화면 폭이 Figma 목업 기준(360)과
  // 다르면(대부분 다름) width만 늘어나고 height는 그대로라 비율이 깨지는 버그였음(2026-09-09
  // 사용자 리포트로 발견) — height 고정 대신 실측 비율(320/234) 그대로 aspectRatio로 전환
  heroImageWrap: { width: '100%', aspectRatio: 320 / 234, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.border },
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
  // 2026-09-09 재실측: 11->12, gray500->gray700
  likeCount: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray700, marginTop: 2 },
  // marginTop을 Figma 실측치(16) 그대로 뒀었는데, titleRow가 하트+개수 컬럼(~41 높이) 때문에 이름
  // 한 줄(29 높이)보다 커서 그 여분 위에 16이 또 쌓여 체감 간격이 훨씬 컸음 — 8로 축소(2026-09-09,
  // 파일 상단 코멘트 1번 참고)
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginTop: 8 },
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
  // 기본정보/리뷰 카드 — topCard와 같은 흰 풀블리드+marginTop12(위 container 코멘트 참고).
  // paddingTop/Bottom은 Figma 실측(354:1345 "콘텐츠"/"리뷰" 프레임, 제목 위 20 여백)
  section: { marginTop: 12, backgroundColor: colors.white, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: 20, letterSpacing: -0.5, color: colors.black, marginBottom: 12 },
  // 사용자 요청으로 확대+더 둥글게(183/8 -> 220/16, 파일 상단 코멘트 4번 참고 — Figma엔 이 크기
  // 변형이 없어서 임의 조정). overflow:hidden은 감싸는 previewMapWrap 쪽에도 있어야 안드로이드에서
  // 실제로 잘림(위 JSX 코멘트 참고) — MapView 자체 borderRadius는 iOS 대비용으로 유지
  previewMap: { width: '100%', height: 220, borderRadius: 16 },
  previewMapWrap: { borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  infoList: { gap: 8 },
  infoRow: { flexDirection: 'row' },
  infoLabel: { width: 64, fontFamily: fonts.medium, fontSize: 12, letterSpacing: -0.3, color: colors.black },
  // 2026-09-09 재실측: gray500->gray700
  infoValue: { flex: 1, fontFamily: fonts.regular, fontSize: 12, letterSpacing: -0.3, lineHeight: 17, color: colors.gray700 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.gray500 },
  // Figma 실측(458:2474 "리뷰" 섹션, 602:15528 카드 등, 2026-09-09) — 2열 그리드, 카드마다 사진
  // 배경+하단 그라디언트+아바타/닉네임/본문 오버레이(파일 상단 코멘트 참고)
  reviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: REVIEW_GRID_GAP },
  gridCard: {
    width: REVIEW_GRID_ITEM_WIDTH,
    height: REVIEW_GRID_ITEM_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.backgroundMuted,
  },
  gridCardPlaceholder: { backgroundColor: colors.backgroundMuted },
  // Figma 실측: 카드 좌우 8, 하단 11 인셋
  gridCardProfile: { position: 'absolute', left: 8, right: 8, bottom: 11 },
  gridCardProfileRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gridCardAvatar: { width: 16, height: 16, borderRadius: 8 },
  gridCardAvatarPlaceholder: { backgroundColor: colors.border },
  // Figma 실측(12/8)이 실기기에서 너무 작다는 사용자 리포트로 닉네임 12->14, 본문 8->11 확대
  // (2026-09-09) — 카드 자체 높이(216)엔 여유가 있어서 레이아웃 안 깨짐
  gridCardNickname: { flex: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 17, color: colors.white },
  // 사진 없는 카드는 어두운 배경/그라디언트가 없어서 흰 글자가 안 보임 — 검정 계열로 전환(위
  // PhotoReviewCard 코멘트 참고)
  gridCardTextOnLight: { color: colors.black },
  gridCardBody: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: -0.2,
    color: '#cccccc',
    marginTop: 4,
  },
  gridCardBodyOnLight: { color: colors.gray700 },
});
