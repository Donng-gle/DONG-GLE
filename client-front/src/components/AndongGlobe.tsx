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

// 드래그 1px당 회전각(도). 0.5로 뒀더니 살짝만 밀어도 옆면(90도 근처, 거의 안 보이는 얇은 조각)까지
// 확 돌아가버려서 훨씬 둔감하게 낮춤 — 화면 폭만큼(size px) 쭉 밀어야 대략 45도 정도 도는 정도
// (2026-09-04 튜닝, decision-log 참고)
const DEGREES_PER_PIXEL = 0.12;

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

  // perspective가 size*2(원래 값)처럼 이미지 크기 대비 많이 크면 카메라가 아주 멀리서 보는 셈이라
  // 거의 정사영(orthographic)에 가까워져서, 이미지 전체가 평평한 종이 한 장처럼 균일하게 기울어지기만
  // 함. 값을 size 자체보다 작게(카메라를 이미지에 바짝 붙임) 낮추면 원근 왜곡이 훨씬 강해져서 —
  // 회전축에서 먼 쪽 가장자리는 눈에 띄게 좁아지고 가까운 쪽은 살짝 커 보이는 식으로 — 평면이 아니라
  // 곡면(구)처럼 보이는 효과가 생김 (2026-09-04 튜닝, decision-log 참고)
  const perspective = size * 0.55;

  return (
    <View style={[styles.container, { width: size, height: size * 1.08 }]}>
      <View style={[styles.imageWrap, { width: size, height: size }]} {...panResponder.panHandlers}>
        <Animated.Image
          source={MAP_SOURCE}
          resizeMode="contain"
          style={[
            styles.image,
            { width: size, height: size, transform: [{ perspective }, { rotateY }] },
          ]}
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
  imageWrap: { alignItems: 'center', justifyContent: 'center' },
  image: {},
  shadow: {
    marginTop: -8,
    borderRadius: 100,
    backgroundColor: '#000000',
    opacity: 0.16,
  },
});
