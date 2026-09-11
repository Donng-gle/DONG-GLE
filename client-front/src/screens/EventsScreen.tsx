import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EventListItem, eventApi } from '../api/event';
import { LocationPinIcon } from '../components/icons';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { PlaceDetailScreen } from './PlaceDetailScreen';

interface Props {
  onExit: () => void;
}

function dDayLabel(dDay: number) {
  if (dDay < 0) return '종료';
  if (dDay === 0) return '진행 중';
  return `D-${dDay}`;
}

// 그동안 스타일 하나 없는 기본 화면(Button/인라인 색상)이었던 걸 정식으로 디자인함(2026-09-11,
// 사용자 확인 — "메인 페이지-안동 거리"(334:3255) 프레임의 "관광지 관련 명소" 카드 리스트와
// 동일하게 가져가자). StreetTab.tsx의 PlaceCategoryCard(사진 히어로+그라디언트+배지, 흰 카드+그림자)
// 스타일을 그대로 재사용 — 다만 이 화면엔 그 카드에 없는 요소가 필요해서 조정함:
// - 카테고리 배지 자리에 D-day 배지(이 화면의 핵심 정보이자 기존 로직 그대로, dDayLabel 재사용)
// - 하트(찜) 버튼은 제외 — EventListItem에 찜 개념 자체가 없음(is_liked 필드 없음), 없는 기능을
//   지어내지 않기 위한 선택(다른 화면들과 동일 원칙)
// - 주소 아래 행사 기간(event_start_date~event_end_date) 한 줄 추가
// - StreetTab은 바텀시트(지도 위에 얹힘)라 헤더가 없지만, 이 화면은 드로어에서 바로 여는 독립
//   화면이라 PlaceListScreen.tsx와 동일한 뒤로가기+제목 헤더를 둠
//
// 카드 탭 → 상세 페이지도 "관광지 상세 페이지" 프레임과 동일하게(2026-09-11, 사용자 확인) — 새로
// 화면을 또 만드는 대신 PlaceDetailScreen을 그대로 재사용함. 행사·축제는 별도 ENTITY가 아니라
// PLACE.category='축제행사'인 장소일 뿐이고(SSOT 참고), EventListItem.id도 실제로 그 Place.id
// 그대로임(server EventService.toEventListItemResponse가 Place.id를 그대로 씀, 2026-09-11 확인)
// — 그래서 StreetTab.tsx가 PlaceDetailScreen을 여는 것과 완전히 같은 패턴으로 열면 됨
export function EventsScreen({ onExit }: Props) {
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<EventListItem[] | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<number | null>(null);

  useEffect(() => {
    eventApi
      .list()
      .then((response) => setEvents(response.events))
      .catch((e) => {
        Alert.alert('행사 목록을 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
        setEvents([]);
      });
  }, []);

  if (selectedPlaceId != null) {
    return <PlaceDetailScreen placeId={selectedPlaceId} onExit={() => setSelectedPlaceId(null)} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onExit} hitSlop={8} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>이달의 행사·축제</Text>
        <View style={styles.backButton} />
      </View>

      {events === null ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.black} />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>이번 달 행사가 없어요.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => setSelectedPlaceId(item.id)}>
              <View style={styles.cardImageWrap}>
                {item.main_image_url ? (
                  <Image source={{ uri: item.main_image_url }} style={styles.cardImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
                )}
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.2)']} style={StyleSheet.absoluteFill} />
                <View style={styles.dDayBadge}>
                  <Text style={styles.dDayBadgeText}>{dDayLabel(item.d_day)}</Text>
                </View>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.cardDate}>
                  {item.event_start_date} ~ {item.event_end_date}
                </Text>
                {item.addr1 && (
                  <View style={styles.cardAddrRow}>
                    <LocationPinIcon size={13} />
                    <Text style={styles.cardAddr} numberOfLines={1}>
                      {item.addr1}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  backButton: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 18, color: colors.black },
  headerTitle: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.black },
  list: { paddingHorizontal: 18, paddingBottom: 40 },
  emptyText: { textAlign: 'center', color: colors.gray400, fontFamily: fonts.regular, fontSize: 13, marginTop: 40 },
  // StreetTab.tsx PlaceCategoryCard 기반이었는데 이 화면(꽉 찬 리스트)엔 너무 커 보인다는 피드백
  // (2026-09-11)으로 전체적으로 축소 — 사진 비율을 세로로 짧게, 폰트/여백도 한 단계씩 줄임
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardImageWrap: {
    width: '100%',
    aspectRatio: 2.4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  cardImage: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  cardImagePlaceholder: { backgroundColor: colors.border },
  dDayBadge: {
    position: 'absolute',
    left: 10,
    top: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  dDayBadgeText: { fontFamily: fonts.bold, fontSize: 12, color: colors.danger },
  cardInfo: { paddingTop: 8, paddingHorizontal: 4, paddingBottom: 4 },
  cardName: { fontFamily: fonts.medium, fontSize: 15, color: colors.black },
  cardDate: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray500, marginTop: 2 },
  cardAddrRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  cardAddr: { fontFamily: fonts.regular, fontSize: 12, color: colors.black, flexShrink: 1 },
});
