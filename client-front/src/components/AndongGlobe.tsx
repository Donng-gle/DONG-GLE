import { useRef } from 'react';
import { Animated, Image, PanResponder, StyleSheet, View } from 'react-native';

// Figma 노드 506:11127("지도-2")의 지도 이미지("1111111 1/2/3")를 내보낸 파일 — 안동시 행정구역
// 입체(아이소메트릭) 일러스트 지도. 원본 프레임에 동일한 이미지가 옆으로 3장 나란히 배치돼 있던 걸
// 보고, 가로로 드래그하면 무한 루프처럼 넘어가며 "지구본을 돌리는" 느낌을 주려는 의도로 해석함
// (2026-09-04, decision-log 참고)
//
// 노드 506:11114("222 1", 안동 랜드마크 컬러 일러스트)는 이번 라운드에서 일단 제외하기로 함
// (2026-09-04 결정, decision-log 참고) — 나중에 에셋 받으면 이 컴포넌트에 다시 얹으면 됨
const MAP_TILE_SOURCE = require('../../assets/images/andong-globe-map.png');

interface Props {
  size: number; // 정사각형 한 변 길이(px)
}

function wrapOffset(value: number, tileSize: number): number {
  return ((value % tileSize) + tileSize) % tileSize;
}

export function AndongGlobe({ size }: Props) {
  const translateX = useRef(new Animated.Value(-size)).current;
  const baseOffset = useRef(0); // 0~size 범위로 정규화된 누적 드래그량

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 2,
      onPanResponderMove: (_, gesture) => {
        translateX.setValue(-size + wrapOffset(baseOffset.current + gesture.dx, size));
      },
      onPanResponderRelease: (_, gesture) => {
        baseOffset.current = wrapOffset(baseOffset.current + gesture.dx, size);
        translateX.setValue(-size + baseOffset.current);
      },
      onPanResponderTerminate: (_, gesture) => {
        baseOffset.current = wrapOffset(baseOffset.current + gesture.dx, size);
        translateX.setValue(-size + baseOffset.current);
      },
    }),
  ).current;

  return (
    <View style={[styles.container, { width: size, height: size }]} {...panResponder.panHandlers}>
      <Animated.View style={[styles.tileRow, { width: size * 3, transform: [{ translateX }] }]}>
        {[0, 1, 2].map((i) => (
          <Image key={i} source={MAP_TILE_SOURCE} style={{ width: size, height: size }} resizeMode="contain" />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  tileRow: { flexDirection: 'row' },
});
