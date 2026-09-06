import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { PlaceCategory, PlaceListItem, PlaceMapPin, placeApi } from '../../api/place';
import { PlaceListItemRow } from '../../components/PlaceListItemRow';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/fonts';
import { PlaceDetailScreen } from '../PlaceDetailScreen';

const ANDONG_REGION = { latitude: 36.5684, longitude: 128.7294, latitudeDelta: 0.14, longitudeDelta: 0.14 };
// placeApi.map()의 bounds 포맷("swLat,swLng,neLat,neLng") — 지도 이동에 따른 재조회는 아직 연동 전이라
// 안동시 전역을 덮는 고정 뷰포트로 요청함 (2026-08-31 결정, decision-log 참고)
const ANDONG_BOUNDS = '36.44,128.62,36.70,128.84';
const CATEGORIES: PlaceCategory[] = ['관광지', '식당', '카페', '액티비티', '문화공간', '축제행사'];
const PAGE_SIZE = 20;

// Figma 노드 334:3255("메인 페이지-안동 거리") — 지도+카테고리 칩+장소 리스트.
// 디자인엔 카드별 별점(★4.0)이 있지만 visit_log 스키마에 별점 컬럼이 없어서(decision-log 확인 필요
// 항목) 생략함 — 없는 데이터를 지어내지 않기 위한 선택
export function StreetTab() {
  const [category, setCategory] = useState<PlaceCategory | null>(null);
  const [pins, setPins] = useState<PlaceMapPin[] | null>(null);
  const [places, setPlaces] = useState<PlaceListItem[] | null>(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // 카드를 눌러도 상세로 안 넘어가던 문제 수정(2026-09-05) — PlaceListScreen이 이미 쓰던
  // PlaceListItemRow+PlaceDetailScreen 조합을 그대로 재사용
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    setPins(null);
    loadPlaces(1);
    placeApi
      .map(ANDONG_BOUNDS, category ? { category } : {})
      .then((res) => setPins(res.pins))
      .catch(() => setPins([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  // 관광지만 107건이라 기본 페이지(20건)로는 카테고리 하나도 다 못 보여줌 — 스크롤 끝에서
  // 다음 페이지를 이어붙이는 방식으로 전체를 다 볼 수 있게 함 (2026-09-04 수정, decision-log 참고).
  // 지도 핀(placeApi.map)은 원래부터 페이지네이션 없이 뷰포트 안 전체를 한 번에 받아오므로 그대로 둠
  function loadPlaces(pageToLoad: number) {
    if (pageToLoad === 1) {
      setPlaces(null);
    } else {
      setLoadingMore(true);
    }
    const params = category ? { category } : {};
    placeApi
      .list({ ...params, page: pageToLoad, size: PAGE_SIZE })
      .then((res) => {
        setPlaces((prev) => (pageToLoad === 1 ? res.places : [...(prev ?? []), ...res.places]));
        setPage(pageToLoad);
        setHasNext(res.meta.has_next);
      })
      .catch(() => {
        if (pageToLoad === 1) setPlaces([]);
      })
      .finally(() => setLoadingMore(false));
  }

  function loadMorePlaces() {
    if (!loadingMore && hasNext) loadPlaces(page + 1);
  }

  if (selectedId != null) {
    return <PlaceDetailScreen placeId={selectedId} onExit={() => setSelectedId(null)} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <MapView provider={PROVIDER_GOOGLE} style={styles.map} initialRegion={ANDONG_REGION}>
          {(pins ?? [])
            .filter((p) => p.lat != null && p.lng != null)
            .map((p) => (
              <Marker
                key={p.id}
                coordinate={{ latitude: p.lat as number, longitude: p.lng as number }}
                title={p.name}
                description={p.category}
                onPress={() => setSelectedId(p.id)}
              />
            ))}
        </MapView>
        {pins === null && (
          <View style={[StyleSheet.absoluteFill, styles.mapLoading]}>
            <ActivityIndicator color={colors.black} />
          </View>
        )}
      </View>

      <View style={styles.chipRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowContent}>
          <TouchableOpacity style={[styles.chip, category === null && styles.chipActive]} onPress={() => setCategory(null)}>
            <Text style={[styles.chipText, category === null && styles.chipTextActive]}>전체</Text>
          </TouchableOpacity>
          {CATEGORIES.map((c) => (
            <TouchableOpacity key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}>
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        style={styles.list}
        data={places ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={places !== null ? <Text style={styles.emptyText}>해당 카테고리에 장소가 없어요</Text> : null}
        onEndReached={loadMorePlaces}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.black} style={styles.footerLoading} /> : null}
        renderItem={({ item }) => <PlaceListItemRow place={item} onPress={() => setSelectedId(item.id)} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapWrap: { height: 220 },
  map: { flex: 1 },
  mapLoading: { alignItems: 'center', justifyContent: 'center' },
  footerLoading: { marginVertical: 16 },
  chipRow: { paddingVertical: 12 },
  chipRowContent: { paddingHorizontal: 20, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.black, borderColor: colors.black },
  chipText: { fontFamily: fonts.medium, fontSize: 13, letterSpacing: -0.3, color: colors.gray700 },
  chipTextActive: { color: colors.white },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 12 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.gray500, textAlign: 'center', marginTop: 40 },
});
