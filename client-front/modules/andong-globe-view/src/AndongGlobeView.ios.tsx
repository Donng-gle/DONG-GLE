import * as React from 'react';
import { Animated, Image, StyleSheet } from 'react-native';

import { AndongGlobeViewProps } from './AndongGlobeView.types';

// iOS엔 네이티브 지구본 모듈이 없음(Android만 View.rotationY + cameraDistance 커스텀 Expo 모듈로
// 구현돼 있음 — AndongGlobeView.android.tsx, ../android/.../AndongGlobeView.kt 참고). 그래서 순수
// RN transform(perspective + rotateY)으로 대체한다.
//
// 이 방식은 원래 2026-09-04에 "회전 중 가장자리가 계단식으로 깨진다"는 이유로 안드로이드에서
// 폐기되고 네이티브 모듈로 교체됐었다(AndongGlobe.tsx 상단 주석 참고). 하지만 그건 안드로이드
// 실기기에서 확인된 문제이고, iOS Core Animation은 3D 트랜스폼 안티에일리어싱을 다르게(대체로 더
// 매끄럽게) 처리하는 경우가 많아서 iOS에서 다시 시도해본다.
//
// ⚠️ 2026-09-13 작성 시점엔 이 Mac에 Xcode가 없어서 시뮬레이터/실기기로 직접 확인 못 했음 —
// 계단현상이 iOS에서도 재현되면 이 파일을 SwiftUI/UIKit 네이티브 모듈로 다시 교체해야 할 수 있음.
// 실기기 확인 전까지는 미검증 상태로 취급할 것
const IMAGE = require('../../../assets/images/andong-globe-map.png');

// Android View.cameraDistance(인치)와 CSS/RN perspective(px)는 단위/기준점이 달라서 값을 그대로
//못 옮긴다. "작을수록 원근 왜곡이 강해진다"는 관계만 동일하게 유지하고 절대값은 화면 크기 기준으로
// 근사함 — 실제 곡면 느낌은 실기기로 다시 튜닝 필요
function toPerspective(cameraDistanceInches: number): number {
  return cameraDistanceInches * 40;
}

export default function AndongGlobeView({ style, rotationDeg, cameraDistanceInches }: AndongGlobeViewProps) {
  return (
    <Animated.View
      style={[
        style,
        styles.clip,
        {
          transform: [{ perspective: toPerspective(cameraDistanceInches) }, { rotateY: `${rotationDeg}deg` }],
        },
      ]}
    >
      <Image source={IMAGE} style={styles.image} resizeMode="contain" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
});
