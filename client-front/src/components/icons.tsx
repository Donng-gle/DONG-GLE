import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme/colors';

// HomeScreen.tsx에 있던 걸 AppHeader.tsx(마이페이지 등 다른 화면에서도 같은 헤더 재사용)와
// 같이 쓰려고 공용 컴포넌트로 뽑음 (2026-09-05). Figma 아이콘 벡터(Ellipse+Rectangle 등)를
// 별도 에셋 없이 단순 도형으로 재현한 것 — 원본 주석/구현 그대로.
export function HamburgerIcon() {
  return (
    <View style={hamburgerStyles.stack}>
      <View style={hamburgerStyles.bar} />
      <View style={hamburgerStyles.bar} />
      <View style={hamburgerStyles.bar} />
    </View>
  );
}

const hamburgerStyles = StyleSheet.create({
  stack: { width: 20, height: 14, justifyContent: 'space-between' },
  bar: { height: 2, borderRadius: 1, backgroundColor: colors.black },
});

export function ProfileIcon() {
  return (
    <View style={profileIconStyles.container}>
      <View style={profileIconStyles.head} />
      <View style={profileIconStyles.shoulders} />
    </View>
  );
}

const profileIconStyles = StyleSheet.create({
  container: { width: 20, height: 20, alignItems: 'center' },
  head: { width: 7, height: 7, borderRadius: 3.5, borderWidth: 1.3, borderColor: colors.black, marginBottom: 2 },
  shoulders: {
    width: 18,
    height: 8,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderWidth: 1.3,
    borderColor: colors.black,
    borderBottomWidth: 0,
  },
});

// Figma "플러스"(593:12649 등, 24x24) — 나의 일지 헤더의 기록 작성 버튼(2026-09-05 추가)
export function PlusIcon() {
  return (
    <View style={plusIconStyles.container}>
      <View style={plusIconStyles.horizontalBar} />
      <View style={plusIconStyles.verticalBar} />
    </View>
  );
}

const plusIconStyles = StyleSheet.create({
  container: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  horizontalBar: { position: 'absolute', width: 14, height: 1.6, borderRadius: 1, backgroundColor: colors.black },
  verticalBar: { position: 'absolute', width: 1.6, height: 14, borderRadius: 1, backgroundColor: colors.black },
});

// Figma "화살표_오른쪽"(마이페이지 문의 목록 등, 20x20) — 테두리 두 변을 45도 회전시켜 ">" 모양을
// 만드는 흔한 방식(2026-09-06 추가)
export function ChevronRightIcon() {
  return (
    <View style={chevronRightStyles.container}>
      <View style={chevronRightStyles.chevron} />
    </View>
  );
}

const chevronRightStyles = StyleSheet.create({
  container: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  chevron: {
    width: 7,
    height: 7,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: colors.gray500,
    transform: [{ rotate: '45deg' }],
    marginLeft: -2,
  },
});

// 마이페이지 아바타 위에 얹는 "사진 변경" 배지용 — Figma에 명세가 없어서(프로필 사진 변경 자체가
// 시안에 없음) 카메라를 단순 도형(몸체+렌즈)으로 흉내낸 아이콘(2026-09-06 추가, 기존 아이콘들과
// 동일하게 View 조합, 별도 에셋 없음)
export function CameraIcon() {
  return (
    <View style={cameraIconStyles.body}>
      <View style={cameraIconStyles.bump} />
      <View style={cameraIconStyles.lens} />
    </View>
  );
}

const cameraIconStyles = StyleSheet.create({
  body: {
    width: 14,
    height: 10,
    borderRadius: 2,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bump: {
    position: 'absolute',
    top: -2,
    width: 5,
    height: 3,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
    backgroundColor: colors.white,
  },
  lens: { width: 5, height: 5, borderRadius: 2.5, borderWidth: 1.2, borderColor: colors.black },
});

// Figma "돋보기"(225:24476, 검색창 안 20x20 / 메인 GNB 28x28 두 크기로 재사용) 실측 벡터 bbox
// 그대로 재현(2026-09-07 추가/정밀화) — 원(렌즈) bbox: 10.83x10.83@(3.33,3.33)/20,
// 손잡이 bbox: 4.17x4.17@(12.5,12.5)/20. 손잡이는 회전된 사각형이라 bbox만으론 실제 폭을
// 못 구해서(45도 회전 시 bbox변 = (W+H)*cos45) 역산: W = 4.17/cos45 - strokeWidth ≈ 3.9.
// 다른 아이콘들과 다르게 size를 prop으로 받아야 해서(검색창/헤더 두 곳에서 다른 크기로 씀)
// StyleSheet 대신 인라인 스타일 사용
export function SearchIcon({ size = 20, color = colors.black }: { size?: number; color?: string }) {
  const circleSize = size * 0.5415; // 10.83/20
  const strokeWidth = Math.max(1.4, size * 0.1);
  const circleOffset = size * 0.1665; // 3.33/20
  const handleLength = size * 0.195; // 역산한 손잡이 실제 폭(3.9/20)
  const handlePos = size * 0.632; // 손잡이 bbox 중심(14.585/20) 기준 역산한 회전 전 좌상단
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          top: circleOffset,
          left: circleOffset,
          width: circleSize,
          height: circleSize,
          borderRadius: circleSize / 2,
          borderWidth: strokeWidth,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: handlePos,
          left: handlePos,
          width: handleLength,
          height: strokeWidth,
          borderRadius: strokeWidth / 2,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

// Figma "mingcute:location-fill"(검색 자동완성 행, 컨테이너 16x16 안에 실제 도형은
// 12x13.44@(2,1.33) — 가로세로 정사각형이 아니라 세로가 12% 더 긴 통통한 핀 모양이고, 가운데에
// 구멍이 뚫려있음(2026-09-07 정밀화). 이전엔 회전된 둥근 사각형(구멍 없음)으로 근사했었는데
// 실측해보니 실제 도형과 꽤 달라서(구멍 없음, 정사각 비율) react-native-svg(RadarChart.tsx에서
// 이미 쓰던 라이브러리, 추가 설치 없음)로 다시 그림 — 원(반지름=폭의 절반)+짧은 꼬리+가운데
// 구멍(evenodd)의 실측 비율 그대로. 정확한 벡터 path 자체는 Figma에서 못 받아와서(플러그인 호출
// 타임아웃) 실측 bbox에 맞춘 근사 곡선.
export function LocationPinIcon({ size = 16, color = colors.gray500 }: { size?: number; color?: string }) {
  const w = size * 0.75; // 12/16
  const h = size * 0.84; // 13.44/16
  const left = size * 0.125; // 2/16
  const top = size * 0.0831; // 1.33/16
  return (
    <View style={{ width: size, height: size }}>
      <Svg style={{ position: 'absolute', left, top }} width={w} height={h} viewBox="0 0 12 13.44">
        <Path
          fillRule="evenodd"
          fill={color}
          d="M6 13.44C3.5 11.2 0 9.5 0 6a6 6 0 1 1 12 0c0 3.5-3.5 5.2-6 7.44Z M6 3.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Z"
        />
      </Svg>
    </View>
  );
}

// Figma "원형_닫기"(검색창 지우기 버튼, 20x20) — 검색어 입력 중 지우기 버튼용(2026-09-07 추가)
export function CircleCloseIcon({ size = 20 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.55, lineHeight: size * 0.62, color: colors.gray700 }}>×</Text>
    </View>
  );
}

// Figma "bookmark"(관광지 상세 서브_GNB, 458:2474/358:5134 실측, 24x24) — 리본 모양 북마크.
// 찜(찜 상태 place.is_liked)과 같은 동작에 연결돼서 채워진 정도로 상태를 보여줌
// (2026-09-07 추가, PlaceDetailScreen.tsx 참고)
export function BookmarkIcon({ size = 24, filled = false, color = colors.black }: { size?: number; filled?: boolean; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6 3a2 2 0 0 0-2 2v16l8-5 8 5V5a2 2 0 0 0-2-2H6Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={filled ? 0 : 1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
