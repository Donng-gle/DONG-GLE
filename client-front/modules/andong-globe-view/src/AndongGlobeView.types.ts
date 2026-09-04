import type { StyleProp, ViewStyle } from 'react-native';

export type AndongGlobeViewProps = {
  style?: StyleProp<ViewStyle>;
  // 드래그로 계산한 회전각(도). 범위 제한 없음 — 안드로이드 View.rotationY가 360도마다 알아서
  // 원위치로 보이게 처리해줌
  rotationDeg: number;
  // 카메라 거리(dp). 작을수록 원근 왜곡이 강해짐(곡면 느낌) — 튜닝 중
  cameraDistanceDp: number;
};
