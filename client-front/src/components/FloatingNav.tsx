import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  onHome: () => void;
  onShare: () => void;
}

// Figma "메인 페이지-*" 화면들과 485:10903("코스 저장")/488:11855("관광지 저장" = 스크랩북)에
// 동일하게 배치된 하단 플로팅 네비게이션 바. 여러 화면에서 재사용되길래 공용 컴포넌트로 분리함.
// 홈 아이콘이 좌측 버튼과 중앙 강조 버튼 두 군데 있는데 의도가 아직 불명확해서
// (milestone.md "하단 플로팅 네비게이션 실제 의도 — 디자인팀 확인 필요" 참고) 둘 다 잠정적으로 onHome에 연결
export function FloatingNav({ onHome, onShare }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.floatingNav, { bottom: Math.max(20, insets.bottom + 12) }]}>
      <TouchableOpacity style={styles.sideButton} onPress={onHome} hitSlop={6}>
        <Text style={styles.emojiIcon}>🏠</Text>
      </TouchableOpacity>
      <View style={styles.centerSpacer} />
      <TouchableOpacity style={styles.sideButton} onPress={onShare} hitSlop={6}>
        <Text style={styles.emojiIcon}>📤</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onHome} hitSlop={6} style={styles.centerButton}>
        <LinearGradient
          colors={['#ffe500', '#f79030']}
          style={styles.centerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.emojiIcon}>🏠</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingNav: {
    position: 'absolute',
    alignSelf: 'center',
    width: 209,
    height: 52,
    borderRadius: 100,
    backgroundColor: 'rgba(17,17,17,0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  sideButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  centerSpacer: { width: 52 },
  centerButton: {
    position: 'absolute',
    top: -14,
    left: '50%',
    marginLeft: -26,
    width: 52,
    height: 52,
  },
  centerGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiIcon: { fontSize: 18 },
});
