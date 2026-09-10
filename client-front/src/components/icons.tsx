import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
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

// Figma "돋보기"(354:1610/I354:1610;225:23656 인스턴스, export_node_as_image로 실물 렌더 확인,
// 2026-09-09 재작업) — 이전엔 View(원 테두리+회전된 막대)로 근사했는데, 회전된 막대를 top/left로
// 배치한 뒤 transform:rotate를 걸면 RN이 막대 "자기 자신의 중심"을 기준으로 회전시켜서, 의도했던
// 손잡이 중심(14.585,14.585)이 아니라 그보다 오른쪽 아래로 밀린 지점을 중심으로 회전하는 버그가
// 있었음 — 그래서 손잡이가 원 테두리에 자연스럽게 안 붙고 살짝 어긋나 보였음(사용자가 "피그마
// 모양이랑 다르다"고 리포트한 원인). 이번엔 react-native-svg(다른 아이콘들과 동일 라이브러리)의
// Circle+Line으로 좌표를 직접 계산해서 그려 이 문제 자체를 없앰 — 원(렌즈)/손잡이 치수는 기존에
// 실측해뒀던 값 그대로 재사용(원 bbox 10.83x10.83@(3.33,3.33)/20, 손잡이 실제 길이 역산값 3.9,
// 손잡이 중심 14.585/20 — 주석은 그대로 두고 좌표만 SVG용으로 환산)
export function SearchIcon({ size = 20, color = colors.black }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Circle cx={8.745} cy={8.745} r={5.415} stroke={color} strokeWidth={2} />
      <Line x1={13.206} y1={13.206} x2={15.964} y2={15.964} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
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

// 관광지 상세 페이지 헤더의 북마크(찜) 버튼 — Figma 아이콘 컴포넌트 내부 벡터까지는 실측이 안 돼서
// (아이콘 export가 이 세션에서 안 됨) 흔한 리본형 북마크 모양으로 근사(2026-09-09 추가).
// filled=true면 찜한 상태(채워짐), false면 테두리만
export function BookmarkIcon({ size = 24, color = colors.black, filled = false }: { size?: number; color?: string; filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-6-4-6 4V4Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// 관광지 상세 페이지 이름 옆 찜(하트) 버튼 — 기존엔 유니코드 글리프(♥/♡)를 Text로 그려서 Figma의
// 둥근 하트 벡터(354:4731 "heart" 인스턴스, export로 확인)와 모양이 많이 달랐음(글리프는 끝이 뾰족한
// 좁은 하트, 시안은 위쪽 둘레가 훨씬 둥글고 통통함) — react-native-svg로 직접 그려서 교체(2026-09-09).
// 인스턴스 내부 벡터 path 자체는 export가 PNG/PNG형 SVG만 내려줘서 실측 불가 — 흔히 쓰이는 하트
// path(Feather 아이콘 세트 등)로 근사, export 이미지와 비교해 비율 확인함. filled=true면 찜한 상태
// (StreetTab 카드 하트와 동일하게 red #ff4d4d로 채움 — 앱이 흑백 톤이지만 찜만 유일하게 색을 씀,
// 이미 있던 패턴)
export function HeartIcon({ size = 24, color = colors.black, filled = false }: { size?: number; color?: string; filled?: boolean }) {
  const fillColor = filled ? '#ff4d4d' : 'none';
  const strokeColor = filled ? '#ff4d4d' : color;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z"
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

// 장소 리스트 행 왼쪽 아이콘("location" 인스턴스) — 링 구멍이 있는 아웃라인 핀. CourseDetailScreen
// "직접 일정 만들기-기본화면"(501:12088)에서 처음 만들 때 export가 PNG만 내려줘서 실측 불가라
// Lucide "map-pin"(radius 8)으로 근사(2026-09-09). "AI 일정 만들기-화면"(510:11285) export 이미지를
// 다시 확인해보니 원이 더 둥글고 커서(사용자 지적, 2026-09-11) radius 9짜리 더 둥근 변형(Feather
// "map-pin")으로 교체 — 두 시안 다 같은 아이콘을 쓰는 걸로 보여서 공용 컴포넌트 전체를 정정
export function MapPinOutlineIcon({ size = 18, color = colors.gray500 }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={10} r={3} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

// 같은 화면의 "이전 장소에서 X km" 아이콘("navigation-map" 인스턴스) — 핀+구불구불한 길. 근사(2026-09-09)
export function DistanceIcon({ size = 18, color = colors.gray500 }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Path
        d="M13 1.5c-2.15 0-3.9 1.75-3.9 3.9 0 2.93 3.9 6.35 3.9 6.35s3.9-3.42 3.9-6.35c0-2.15-1.75-3.9-3.9-3.9Z"
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Circle cx={13} cy={5.4} r={1.3} stroke={color} strokeWidth={1.4} />
      <Path d="M1 15c1.8 0 1.8-3 3.6-3s1.8 3 3.6 3" stroke={color} strokeWidth={1.4} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

// 같은 화면의 "약 N분" 아이콘("Run" 인스턴스) — 뛰는 사람. 근사(2026-09-09)
export function WalkIcon({ size = 18, color = colors.gray500 }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Circle cx={11} cy={3.2} r={1.6} fill={color} />
      <Path
        d="M7.2 16l2.3-3-.9-2.8-2-1.8M9.6 10.2l3 .5 2 3.6M9.6 10.2l-1.4 2.5 1 3.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// "AI로 코스 만들기" 세부사항 화면(691:12580/691:12626, 시작/종료시간 인풋 우측) — 흔히 쓰이는
// 시계 아이콘(원+짧은/긴 바늘)으로 근사(2026-09-09)
export function ClockIcon({ size = 20, color = colors.gray500 }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.8} />
      <Path d="M12 7v5l3.5 2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// 같은 화면의 "이동수단" 셀렉트박스 화살표("화살표_아래" 인스턴스) — ChevronRightIcon과 같은
// 테두리 회전 기법, 아래를 가리키게 각도만 다르게 함. open=true면 위로 뒤집음(펼친 상태 표시)
export function ChevronDownIcon({ size = 16, color = colors.gray500, open = false }: { size?: number; color?: string; open?: boolean }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size * 0.35,
          height: size * 0.35,
          borderBottomWidth: 1.5,
          borderRightWidth: 1.5,
          borderColor: color,
          transform: [{ rotate: open ? '225deg' : '45deg' }],
          marginTop: open ? size * 0.15 : -size * 0.15,
        }}
      />
    </View>
  );
}
