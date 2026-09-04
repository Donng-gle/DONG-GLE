import { StyleSheet, View, Image } from 'react-native';

// Figma 노드 506:11127("지도-2")의 지도 이미지("1111111")를 내보낸 파일 — 안동시 행정구역
// 입체(아이소메트릭) 일러스트 지도.
//
// 처음엔 이 이미지를 3장 나란히 두고 옆으로 미끄러뜨리는 캐러셀로 만들었다가("지도 넘기는 형태"),
// "하나의 이미지가 지구본처럼 돌아가는 형태"로 다시 만들어서 rotateY 3D 트랜스폼(RN Animated,
// JS 드라이버)으로 회전시켜봤음. 그런데 실기기로 확인해보니 회전 중 가장자리가 계단식으로
// 깨지고(anti-aliasing 없음) 이미지가 부자연스럽게 뭉개져 보이는 문제가 있어서 일단 정적 이미지로
// 원상복귀함 (2026-09-04). RN의 transform: rotateY는 CSS matrix3d를 흉내내는 JS 레이어 변환이라
// 극각도에서 리샘플링 품질이 떨어지는 걸로 보임 — 안드로이드 네이티브 View의 rotationY +
// cameraDistance(Kotlin, ObjectAnimator/ViewPropertyAnimator)를 쓰면 하드웨어 가속 레이어로 훨씬
// 매끈하게 그려질 가능성이 있어 별도로 검토 중 (decision-log 참고)
//
// 노드 506:11114("222 1", 안동 랜드마크 컬러 일러스트)는 이번 라운드에서 일단 제외
const MAP_SOURCE = require('../../assets/images/andong-globe-map.png');

interface Props {
  size: number; // 정사각형 한 변 길이(px)
}

export function AndongGlobe({ size }: Props) {
  return (
    <View style={[styles.container, { width: size, height: size * 1.08 }]}>
      <View style={[styles.imageWrap, { width: size, height: size }]}>
        <Image source={MAP_SOURCE} resizeMode="contain" style={{ width: size, height: size }} />
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
  shadow: {
    marginTop: -8,
    borderRadius: 100,
    backgroundColor: '#000000',
    opacity: 0.16,
  },
});
