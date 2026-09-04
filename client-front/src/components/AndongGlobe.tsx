import { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';

// Figma 노드 506:11127("지도-2")의 지도 이미지("1111111")를 내보낸 파일 — 안동시 행정구역
// 입체(아이소메트릭) 일러스트 지도.
//
// 처음엔 이 이미지를 3장 나란히 두고 옆으로 미끄러뜨리는 캐러셀로 만들었는데("지도 넘기는 형태"),
// 실제로 보니 장당 사이 여백 때문에 사진이 끊겨 넘어가는 느낌이라 지구본과는 달랐음. 이번엔 이미지
// 1장을 rotateY 3D 변환으로 돌려서 "하나의 물체가 세로축을 중심으로 회전"하는 것처럼 바꿈 — 드래그한
// 만큼 회전각이 그대로 누적되고, 원둘레 개념이 없는 rotateY라 wrap 로직 자체가 필요 없어짐
// (2026-09-04 결정, decision-log 참고)
//
// 노드 506:11114("222 1", 안동 랜드마크 컬러 일러스트)는 이번 라운드에서 일단 제외
const MAP_SOURCE = require('../../assets/images/andong-globe-map.png');

interface Props {
  size: number; // 정사각형 한 변 길이(px)
}

// 드래그 1px당 회전각(도) — 화면을 한 번 가로지르면(size px) 대략 반 바퀴 도는 정도로 체감되게 튜닝
const DEGREES_PER_PIXEL = 0.5;

export function AndongGlobe({ size }: Props) {
  const rotation = useRef(new Animated.Value(0)).current; // 각도(도), 범위 제한 없음
  const baseAngle = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 2,
      onPanResponderMove: (_, gesture) => {
        rotation.setValue(baseAngle.current + gesture.dx * DEGREES_PER_PIXEL);
      },
      onPanResponderRelease: (_, gesture) => {
        baseAngle.current += gesture.dx * DEGREES_PER_PIXEL;
        rotation.setValue(baseAngle.current);
      },
      onPanResponderTerminate: (_, gesture) => {
        baseAngle.current += gesture.dx * DEGREES_PER_PIXEL;
        rotation.setValue(baseAngle.current);
      },
    }),
  ).current;

  // rotateY는 각도 값 그 자체를 그대로 쓰면 되고 360도마다 자연히 원위치로 보이므로(원 둘레처럼 wrap할
  // 필요 없음) 아주 넓은 구간을 1:1로 매핑하는 것만으로 충분 — 실제 드래그로는 절대 안 넘는 범위
  const rotateY = rotation.interpolate({
    inputRange: [-100000, 100000],
    outputRange: ['-100000deg', '100000deg'],
  });

  return (
    <View style={[styles.container, { width: size, height: size }]} {...panResponder.panHandlers}>
      <Animated.Image
        source={MAP_SOURCE}
        resizeMode="contain"
        style={[
          styles.image,
          { width: size, height: size, transform: [{ perspective: size * 2 }, { rotateY }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  image: {},
});
