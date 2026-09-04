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
