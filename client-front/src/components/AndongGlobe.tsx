import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { AndongGlobeView } from '../../modules/andong-globe-view';

// "나의 일지" 탭 히어로 — 안동시 지도를 세로축 중심으로 돌려서 지구본처럼 보이게 함.
//
// 시도 순서 (2026-09-04, decision-log 참고):
// 1. 지도 이미지 3장을 옆으로 넘기는 캐러셀 ("지도 넘기는 형태") — 장 사이 여백 때문에 지구본
//    느낌이 안 나서 폐기
// 2. RN Animated.Image의 transform: rotateY (JS/CSS 트랜스폼 흉내) — 실기기에서 회전 중 가장자리가
//    계단식으로 깨짐 확인, 원상복귀
// 3. (현재) 안드로이드 네이티브 View.rotationY + cameraDistance 기반 커스텀 Expo 모듈
//    (`modules/andong-globe-view`) — 안드로이드가 직접 하드웨어 가속 레이어로 3D 회전을 그려줘서
//    CSS 흉내보다 안티에일리어싱 품질이 좋음. 드래그 제스처 자체는 여전히 RN PanResponder로 계산해서
//    각도(도)만 네이티브 뷰에 prop으로 내려줌
//
// 노드 506:11114("222 1", 안동 랜드마크 컬러 일러스트)는 이번 라운드에서 일단 제외

interface Props {
  size: number; // 정사각형 한 변 길이(px)
}

// 드래그 1px당 회전각(도). 0.5로 뒀더니 살짝만 밀어도 옆면까지 확 돌아가버려서 훨씬 둔감하게 낮춤
const DEGREES_PER_PIXEL = 0.12;

// 카메라 거리(인치) — 안드로이드 기본값은 8인치. 컨테이너(size)가 화면 전체 너비라 실제 물리
// 크기가 꽤 커서(반지름 1인치 이상) 4인치처럼 작은 값은 회전 중 화면을 뒤덮을 만큼 극단적으로
// 확대돼버림(2026-09-04 실기기 확인 — 클리핑 버그인 줄 알았는데 실은 컨테이너가 커서 그런 거였음).
// 큰 컨테이너에 맞춰 훨씬 크게 시작해서 다시 튜닝
const CAMERA_DISTANCE_INCHES = 20;

export function AndongGlobe({ size }: Props) {
  const [rotationDeg, setRotationDeg] = useState(0);
  const baseAngle = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 2,
      onPanResponderMove: (_, gesture) => {
        setRotationDeg(baseAngle.current + gesture.dx * DEGREES_PER_PIXEL);
      },
      onPanResponderRelease: (_, gesture) => {
        baseAngle.current += gesture.dx * DEGREES_PER_PIXEL;
        setRotationDeg(baseAngle.current);
      },
      onPanResponderTerminate: (_, gesture) => {
        baseAngle.current += gesture.dx * DEGREES_PER_PIXEL;
        setRotationDeg(baseAngle.current);
      },
    }),
  ).current;

  return (
    <View style={[styles.container, { width: size, height: size * 1.08 }]}>
      <View style={[styles.imageWrap, { width: size, height: size }]} {...panResponder.panHandlers}>
        <AndongGlobeView
          style={{ width: size, height: size, overflow: 'hidden' }}
          rotationDeg={rotationDeg}
          cameraDistanceInches={CAMERA_DISTANCE_INCHES}
        />
      </View>
      {/* Figma 지도 밑 그림자(506:11131) 반영 — 정확한 블러 값은 Figma 연결이 끊겨서 못 가져왔고
          비슷하게 근사함. 채널 재연결되면 실제 blur/opacity로 다듬을 것 */}
      <View style={[styles.shadow, { width: size * 0.62, height: size * 0.07 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  imageWrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  shadow: {
    marginTop: -8,
    borderRadius: 100,
    backgroundColor: '#000000',
    opacity: 0.16,
  },
});
