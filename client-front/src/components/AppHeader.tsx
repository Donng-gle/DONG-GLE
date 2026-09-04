import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { HamburgerIcon, ProfileIcon } from './icons';

interface Props {
  onMenuPress: () => void;
  onSearchPress: () => void;
  onProfilePress: () => void;
}

// HomeScreen(메인 3탭) 헤더를 다른 화면(마이페이지 등)에서도 그대로 쓰기 위해 뽑은 공용 컴포넌트
// (2026-09-05, 원래 HomeScreen.tsx 안에 있던 마크업/스타일 그대로). "메인 페이지-*" Figma 프레임들이
// 전부 이 헤더를 공유해서 쓰는 걸로 보임 — 마이페이지 프레임(506:11198 등)도 동일한 헤더를 씀.
export function AppHeader({ onMenuPress, onSearchPress, onProfilePress }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 13 }]}>
      <View style={styles.headerLeft}>
        <TouchableOpacity onPress={onMenuPress} hitSlop={8} style={styles.iconButton}>
          <HamburgerIcon />
        </TouchableOpacity>
        <Text style={styles.logo}>Dong_Gle</Text>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity onPress={onSearchPress} hitSlop={8} style={styles.iconButton}>
          <Text style={styles.emojiIcon}>🔍</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onProfilePress} hitSlop={8} style={styles.iconButton}>
          <ProfileIcon />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 13,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  emojiIcon: { fontSize: 18 },
  logo: { fontFamily: fonts.logo, fontSize: 24, color: colors.black },
});
