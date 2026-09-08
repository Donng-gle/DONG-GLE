import { colors } from './colors';

// "취향 맞춤 코스" 탭 미리보기 지도(RecommendedTab.tsx)와 코스 상세 지도(PublicCourseDetailScreen.tsx)
// 둘 다 구글맵 기본 스타일 그대로라 POI/대중교통 아이콘·라벨이 잔뜩 떠서 앱의 흑백 톤과 안 어울리고
// "대충 보여준다"는 인상을 준다는 사용자 피드백으로 추가(2026-09-09). POI/대중교통/행정경계 라벨은
// 다 지우고, 도로/땅/물 색만 앱 팔레트(theme/colors.ts) 값으로 단순화 — 두 화면에서 같은 톤을
// 쓰도록 공용으로 뺌
export const MUTED_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: colors.rowDivider }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: colors.gray500 }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: colors.white }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: colors.white }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: colors.border }] },
  { featureType: 'road.highway', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: colors.backgroundMuted }] },
];

// 좌표 목록을 다 담는 지도 영역 계산(경계 상자 * 1.6배 여백, 최소 델타 0.02로 좌표 1개/너무 가까운
// 좌표들일 때 과도하게 확대되는 것 방지) — 원래 RecommendedTab.tsx에만 있던 걸 PublicCourseDetailScreen
// 에도 똑같이 쓰려고 공용으로 뺌(2026-09-09, 코스 상세 지도가 고정된 안동시 전체 영역(ANDONG_REGION)을
// 써서 코스 동선이 화면 한쪽에 작게 몰려 보이던 문제 수정)
export function regionForCoords(coords: { latitude: number; longitude: number }[]) {
  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.02),
    longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.02),
  };
}
