import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

export interface ChoiceOption {
  label: string;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  label: string;
  options: ChoiceOption[];
  onClose: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// FloatingNav의 "일정 생성" 바텀시트(Figma 601:15506)와 같은 모양/애니메이션을 다른 곳에서도
// 쓸 수 있게 뽑아낸 공용 컴포넌트(2026-09-08, 나의 일지 "기록하기" 선택창에 처음 재사용) —
// 흰 바텀시트(둥근 위 모서리 없이 화면 하단에 딱 붙음) + 회색 라벨 + 텍스트만 있는 항목들.
// FloatingNav 자신은 그대로 두고(이미 검증된 코드라 건드리지 않음), 새로 만드는 선택창부터
// 이 컴포넌트를 씀
export function ChoiceBottomSheet({ visible, label, options, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const sheetProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      sheetProgress.setValue(0);
      Animated.timing(sheetProgress, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    } else {
      Animated.timing(sheetProgress, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function pick(action: () => void) {
    onClose();
    action();
  }

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.black, opacity: sheetProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) },
          ]}
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <AnimatedPressable
          onPress={() => {}}
          style={[
            styles.sheet,
            { paddingBottom: Math.max(24, insets.bottom + 12) },
            { transform: [{ translateY: sheetProgress.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] },
          ]}
        >
          <Text style={styles.sheetLabel}>{label}</Text>
          {options.map((option) => (
            <TouchableOpacity key={option.label} style={styles.sheetItem} onPress={() => pick(option.onPress)}>
              <Text style={styles.sheetItemText}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </AnimatedPressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, paddingHorizontal: 28, paddingTop: 28 },
  sheetLabel: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: -0.3, color: colors.gray500, marginBottom: 28 },
  sheetItem: { paddingVertical: 14 },
  sheetItemText: { fontFamily: fonts.medium, fontSize: 16, letterSpacing: -0.4, color: colors.black },
});
