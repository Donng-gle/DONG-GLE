import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { fonts } from '../theme/fonts';
import { colors } from '../theme/colors';

interface Props {
  // 애니메이션(확대→유지→페이드아웃)이 끝나면 한 번 호출됨 — App.tsx가 이걸로 실제 화면 전환 타이밍을 잡음
  onFinish: () => void;
}

// Figma "로그인-앱시작" 프레임 3개(713:11653/11677/11681, 채널 ng64e3nn, 2026-09-11 확인) 재현 —
// 흰 배경에 "Dong_Gle" 로고(Squada One, #111111)가 40px로 작게 나타났다가 60px로 커지고, 마지막
// 프레임은 완전히 빈 흰 화면(페이드아웃 끝난 상태). 실제 좌표 애니메이션 트윈은 시안에 없어서
// (정적 프레임 3장뿐) fontSize 비율(40→60 = 1.5배)만 실측대로 가져오고 타이밍은 통상적인 로고
// 팝업 스플래시 감각으로 정함: 확대(600ms, 살짝 튕기는 back easing) → 유지(250ms) → 페이드아웃
// (400ms) → 완전한 빈 흰 화면(프레임3과 동일 상태)에서 onFinish 호출
//
// 네이티브 스플래시(expo-splash-screen) 없이 순수 JS Animated로만 구현 — App.tsx가 이미 갖고 있던
// 로딩 게이트(checkingSession || !fontsLoaded)를 대체하는 것뿐이라 네이티브 재빌드 없이 Fast
// Refresh로 반영됨
const BASE_FONT_SIZE = 60;
const START_SCALE = 40 / BASE_FONT_SIZE;

export function SplashLogo({ onFinish }: Props) {
  const scale = useRef(new Animated.Value(START_SCALE)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.back(1.3)),
        useNativeDriver: true,
      }),
      Animated.delay(250),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onFinish();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.Text style={[styles.logo, { opacity, transform: [{ scale }] }]}>Dong_Gle</Animated.Text>
  );
}

const styles = StyleSheet.create({
  logo: {
    fontFamily: fonts.logo,
    fontSize: BASE_FONT_SIZE,
    color: colors.black,
  },
});
