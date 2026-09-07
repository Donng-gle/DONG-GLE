import { useState } from 'react';
import { Dimensions, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { PlaceCategory } from '../../api/place';
import { AndongGlobe } from '../../components/AndongGlobe';
import { colors } from '../../theme/colors';
import { PlaceListScreen } from '../PlaceListScreen';

const GLOBE_SIZE = Dimensions.get('window').width;

// Figma 노드 334:3255("메인 페이지-안동 거리") 실측 — 구글맵+칩+리스트였던 걸 전면 교체.
// 실제론 인터랙티브 지도가 아니라 안동시 일러스트(360x360) 위에 카테고리별 3D 아이콘 6개를 정해진
// 위치에 얹어둔 디자인이라, 나의 일지 탭에서 쓰던 AndongGlobe(사용자 명시 요청 — "기존 메인
// 화면에 있던 지도")를 그대로 재사용하고 그 위에 이 6개 아이콘을 오버레이함. 리스트/칩은 사용자가
// "다른 어떤 리스트도 띄워두지 않고"라고 명시적으로 빼라고 해서 안 만듦 — 카테고리를 누르면
// PlaceListScreen(그 카테고리로 초기 필터링)으로 이동해서 목록을 봄(2026-09-07 결정, decision-log 참고).
//
// 아이콘 6개는 Figma에 실제 이미지로 박혀있는 걸(라벨+점 마커까지 이미지 안에 다 포함) 사용자가
// PNG로 내보내서 줌 — assets/images/street-categories/*.png. 원본이 50x75(1x)라 실기기에서 다소
// 흐릿하게 보일 수 있음, 더 선명하게 하려면 Figma에서 2x/3x로 다시 내보내 받아야 함.
//
// AndongGlobe는 원래 드래그로 회전 가능한데(나의 일지 탭), 그 상태로 아이콘을 얹으면 회전할수록
// 아이콘 위치와 실제 지도 텍스처가 어긋나므로 이 화면에서만 interactive=false로 회전을 꺼서
// 아이콘이 항상 제자리에 고정되게 함(AndongGlobe.tsx에 prop 추가)
const CATEGORY_MARKERS: {
  category: PlaceCategory;
  icon: number;
  // Figma 실측(334:3255 하위 6개 Frame) — 360x360 지도 기준 좌상단 좌표+크기, 비율로 환산해서
  // GLOBE_SIZE(기기 폭)에 맞춰 스케일
  left: number;
  top: number;
  width: number;
  height: number;
}[] = [
  {
    category: '관광지',
    icon: require('../../../assets/images/street-categories/tourist-spot.png'),
    left: 161 / 360,
    top: 35 / 360,
    width: 50 / 360,
    height: 75 / 360,
  },
  {
    category: '카페',
    icon: require('../../../assets/images/street-categories/cafe.png'),
    left: 247 / 360,
    top: 88 / 360,
    width: 50 / 360,
    height: 75 / 360,
  },
  {
    category: '액티비티',
    icon: require('../../../assets/images/street-categories/activity.png'),
    left: 170 / 360,
    top: 138 / 360,
    width: 50 / 360,
    height: 75 / 360,
  },
  {
    category: '축제행사',
    icon: require('../../../assets/images/street-categories/festival.png'),
    left: 67 / 360,
    top: 96 / 360,
    width: 50 / 360,
    height: 75 / 360,
  },
  {
    category: '문화공간',
    icon: require('../../../assets/images/street-categories/culture.png'),
    left: 92 / 360,
    top: 188 / 360,
    width: 50 / 360,
    height: 75 / 360,
  },
  {
    category: '식당',
    icon: require('../../../assets/images/street-categories/restaurant.png'),
    left: 238 / 360,
    top: 226 / 360,
    width: 50 / 360,
    height: 75 / 360,
  },
];

export function StreetTab() {
  const [openCategory, setOpenCategory] = useState<PlaceCategory | null>(null);

  if (openCategory != null) {
    return <PlaceListScreen initialCategory={openCategory} onExit={() => setOpenCategory(null)} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.globeWrap}>
        <AndongGlobe size={GLOBE_SIZE} interactive={false} />
        <View style={[styles.markerLayer, { width: GLOBE_SIZE, height: GLOBE_SIZE }]} pointerEvents="box-none">
          {CATEGORY_MARKERS.map((m) => (
            <TouchableOpacity
              key={m.category}
              style={[
                styles.marker,
                {
                  left: m.left * GLOBE_SIZE,
                  top: m.top * GLOBE_SIZE,
                  width: m.width * GLOBE_SIZE,
                  height: m.height * GLOBE_SIZE,
                },
              ]}
              onPress={() => setOpenCategory(m.category)}
            >
              <Image source={m.icon} style={styles.markerImage} resizeMode="contain" />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  globeWrap: { alignItems: 'center' },
  // AndongGlobe 컨테이너(size*1.08, 그림자 포함) 위에 지도 이미지 영역(size x size)만큼만 덮는
  // 절대배치 오버레이 — 그림자 아래로는 마커가 안 걸리게 top:0 기준
  markerLayer: { position: 'absolute', top: 0 },
  marker: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  markerImage: { width: '100%', height: '100%' },
});
