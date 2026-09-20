import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

interface Props {
  number: number;
}

// 지도 위 코스 번호 핀 — Figma "AI 일정 만들기-화면"(510:11285) "Huge-icon/navigation maps/outline/
// location" 재현. get_node_info로 읽은 원시 노드 데이터(파스텔 핑크 원 + 파란 번호 텍스트 + 파란
// 반투명 타원)만 보고 처음엔 "원 + 텍스트"로 구현했었는데, 중첩된 벡터 자식이 children:[]로 잘려서
// 실제로는 "파란 물방울(핀) 모양 안에 핑크 원"이라는 걸 놓쳤음(2026-09-10, 사용자 지적) —
// export_node_as_image로 렌더 확인 후 표준 pin 실루엣(FontAwesome map-marker-alt)으로 재현했다가,
// "더 둥글게" 재요청(2026-09-11)에 같은 노드를 scale 12로 다시 export해서 정밀 비교해보니 실제
// 시안은 꼬리가 훨씬 짧고 뭉툭해서(원 중심~꼭짓점 거리가 반지름의 약 1.23배 — 거의 원에 가까움)
// 기존 근사 패스로는 아무리 세로를 눌러도 한계가 있었음. 그래서 "원 + 꼭짓점으로 이어지는 두 접선"
// 공식으로 직접 재구성(원점 기준 r=14, 접선 각도 β=arccos(r/d), d=1.227r):
//   T1=(cx-r·sinβ, cy+r·cosβ), T2=(cx+r·sinβ, cy+r·cosβ), apex=(cx, cy+d)
//   패스: T1 → L apex → L T2 → A(큰 호, 위쪽 절반) T1로 복귀
// CourseResultScreen.tsx/PublicCourseDetailScreen.tsx 둘 다 이 컴포넌트를 씀(같은 시안 510:11285
// 기반). CourseDetailScreen(다른 시안 501:12088)은 이번에도 확인 안 해서 그대로 둠
const PIN_PATH = 'M11.89 27.41 L20 33.18 L28.11 27.41 A14 14 0 1 0 11.89 27.41 Z';

export function MapPin({ number }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.pinBox}>
        <Svg width={38} height={38} viewBox="0 0 40 40" style={StyleSheet.absoluteFill}>
          <Path d={PIN_PATH} fill={colors.accentBlue} />
          <Circle cx={20} cy={16} r={10} fill={colors.pinBackground} />
        </Svg>
        <View style={styles.pinTextBox}>
          <Text style={styles.pinText}>{number}</Text>
        </View>
      </View>
      <View style={styles.pinShadow} />
    </View>
  );
}

// 핀은 살짝 키우고 안쪽 숫자는 줄여달라는 요청(2026-09-11) — pinBox 32→38(viewBox 40x40 그대로라
// 원 비율 왜곡 없음), 숫자 fontSize 14→12.
// 숫자가 원 정중앙에서 미세하게 벗어나 보인다는 지적(2026-09-11) — top 픽셀값을 눈대중으로 조정하는
// 대신(line-height 때문에 글자마다 미묘하게 다르게 보임), 원의 실제 바운딩 박스(cx=20,cy=16,r=10을
// pinBox 38/viewBox 40 비율로 환산 → left 9.5, top 5.7, 19x19) 크기의 컨테이너를 만들고 그 안에서
// flexbox center로 맞춤 — 픽셀값 추측보다 원의 기하학적 중심에 정확히 맞음
const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  pinBox: { width: 38, height: 38 },
  pinTextBox: {
    position: 'absolute',
    left: 9.5,
    top: 5.7,
    width: 19,
    height: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.accentBlue,
  },
  pinShadow: { width: 27, height: 4, borderRadius: 2, backgroundColor: colors.accentBlue, opacity: 0.48, marginTop: 2 },
});
