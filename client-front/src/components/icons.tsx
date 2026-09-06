import { StyleSheet, View } from 'react-native';
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
