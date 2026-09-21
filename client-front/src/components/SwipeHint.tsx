import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

const NUDGE = 70;
const AUTO_DISMISS_MS = 4000;

// 스와이프 화면에 들어와 첫 카드가 뜰 때마다: 카드가 좌우로 살짝 밀렸다 돌아오며 방식을 알려준다.
// 카드의 position 값을 그대로 움직이므로 기울어짐(rotate)도 실제 스와이프와 똑같이 나온다.
// "최초 1회"로 기기에 저장하던 방식은 iOS 키체인이 앱 삭제 후에도 남아서 재설치해도 영영 안 뜨는
// 문제가 있어 저장 없이 화면 진입마다 보여준다(터치하거나 4초 지나면 사라짐)
export function useSwipeHint(position: Animated.ValueXY, ready: boolean) {
  const [visible, setVisible] = useState(false);
  const startedRef = useRef(false);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (animRef.current) {
      animRef.current.stop();
      animRef.current = null;
      position.setValue({ x: 0, y: 0 });
    }
    setVisible(false);
  }, [position]);

  useEffect(() => {
    if (!ready || startedRef.current) return;
    startedRef.current = true;
    setVisible(true);
    const move = (x: number) => Animated.timing(position.x, { toValue: x, duration: 450, useNativeDriver: false });
    animRef.current = Animated.sequence([
      Animated.delay(500),
      move(NUDGE),
      move(0),
      move(-NUDGE),
      move(0),
      Animated.delay(200),
      move(NUDGE),
      move(0),
      move(-NUDGE),
      move(0),
    ]);
    animRef.current.start(() => {
      animRef.current = null;
    });
    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
  }, [ready, position, dismiss]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      animRef.current?.stop();
    },
    [],
  );

  return { visible, dismiss };
}

export function SwipeHintOverlay({ visible, subText }: { visible: boolean; subText?: string }) {
  if (!visible) return null;
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.pill}>
        <Text style={styles.text}>←  좌우로 밀어서 선택해요  →</Text>
        {subText ? <Text style={styles.subText}>{subText}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    maxWidth: '90%',
  },
  text: { fontFamily: fonts.semiBold, fontSize: 15, letterSpacing: -0.3, color: colors.white },
  subText: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4, textAlign: 'center' },
});
