import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

interface Props {
  number: number;
}

// 지도 위 코스 번호 핀 — Figma "AI 일정 만들기-화면"(510:11285) "Huge-icon/navigation maps/outline/
// location" 재현(2026-09-10, 채널 h962fplg). get_node_info로 읽은 원시 노드 데이터(파스텔 핑크 원 +
// 파란 번호 텍스트 + 파란 반투명 타원)만 보고 "원 + 텍스트"로 구현했었는데, 중첩된 벡터 자식이
// children:[]로 잘려서 실제로는 "파란 물방울(핀) 모양 안에 핑크 원"이라는 걸 놓쳤음 — 이미지로
// export_node_as_image 렌더 확인 후 재현(사용자 지적, 2026-09-10). CourseResultScreen.tsx/
// PublicCourseDetailScreen.tsx 둘 다 이 컴포넌트를 씀(같은 시안 510:11285 기반). CourseDetailScreen
// (다른 시안 501:12088)은 이번에 확인 안 해서 그대로 둠 — 같은 문제일 수 있어 별도 확인 필요.
//
// 정확한 베지어 패스는 MCP가 SVG 원본 텍스트를 안 줘서(export_node_as_image가 이미지로만 렌더되고
// raw path는 못 읽음) 표준 "location pin" 물방울 실루엣(FontAwesome map-marker-alt)을 실측 비율에
// 맞춰 사용 — 핀 원형부 중심에 안쪽 원(핀 폭의 약 58%, Figma 실측 25.08/43)이 오도록 배치
const PIN_PATH =
  'M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0z';

export function MapPin({ number }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.pinBox}>
        <Svg width={30} height={40} viewBox="0 0 384 512" style={StyleSheet.absoluteFill}>
          <Path d={PIN_PATH} fill={colors.accentBlue} />
          <Circle cx={192} cy={190} r={150} fill={colors.pinBackground} />
        </Svg>
        <Text style={styles.pinText}>{number}</Text>
      </View>
      <View style={styles.pinShadow} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  pinBox: { width: 30, height: 40 },
  pinText: {
    position: 'absolute',
    top: 5,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.accentBlue,
  },
  pinShadow: { width: 25, height: 4, borderRadius: 2, backgroundColor: colors.accentBlue, opacity: 0.48, marginTop: 3 },
});
