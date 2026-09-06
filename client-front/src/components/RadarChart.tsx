import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

// 감성태그 7개 대분류(ssot.md) — 화면에 항상 이 순서/이 7개로 축을 그림(응답 순서가 뒤섞이거나
// 일부만 와도 축이 흔들리지 않게). 짧은 한글 라벨은 SSOT에 정식 표기가 없어서 설명 요약으로 붙임.
const AXIS_ORDER: { tag: string; label: string }[] = [
  { tag: 'relaxing', label: '여유' },
  { tag: 'lively', label: '활기' },
  { tag: 'romantic', label: '로맨틱' },
  { tag: 'local', label: '로컬' },
  { tag: 'photogenic', label: '포토제닉' },
  { tag: 'traditional', label: '전통' },
  { tag: 'modern', label: '모던' },
];

interface Props {
  // score는 0~1. 없는 태그는 중립값(0.5)으로 채워서 그림(ssot.md "0.5 중립 기준선" 참고)
  data: { tag: string; score: number }[];
  size?: number;
}

// 다각형 꼭짓점 좌표 계산 — 12시 방향(-90deg)부터 시계방향으로 축을 배치
function pointsOnAxes(center: number, radius: number, ratio: number): [number, number][] {
  const n = AXIS_ORDER.length;
  return AXIS_ORDER.map((_, i) => {
    const angle = -90 + (360 / n) * i;
    const rad = (angle * Math.PI) / 180;
    return [center + radius * ratio * Math.cos(rad), center + radius * ratio * Math.sin(rad)];
  });
}

function toPointsAttr(points: [number, number][]): string {
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}

export function RadarChart({ data, size = 220 }: Props) {
  const center = size / 2;
  const radius = size * 0.34; // 라벨 들어갈 여백 남기고 폴리곤 반지름 정함
  const labelRadius = radius * 1.28;

  const scoreByTag = new Map(data.map((d) => [d.tag, d.score]));
  const values = AXIS_ORDER.map((a) => scoreByTag.get(a.tag) ?? 0.5);

  const dataPoints = AXIS_ORDER.map((_, i) => {
    const angle = -90 + (360 / AXIS_ORDER.length) * i;
    const rad = (angle * Math.PI) / 180;
    const r = radius * Math.max(0, Math.min(1, values[i]));
    return [center + r * Math.cos(rad), center + r * Math.sin(rad)] as [number, number];
  });

  const outerGrid = pointsOnAxes(center, radius, 1);
  const midGrid = pointsOnAxes(center, radius, 0.5); // 중립 기준선(0.5) — ssot.md 참고
  const innerGrid = pointsOnAxes(center, radius, 0.25);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* 축선 (중심 -> 각 꼭짓점) */}
        {outerGrid.map(([x, y], i) => (
          <Line key={`axis-${i}`} x1={center} y1={center} x2={x} y2={y} stroke={colors.border} strokeWidth={1} />
        ))}
        {/* 그리드 링 3겹(0.25 / 0.5 중립 기준선 / 1.0) */}
        <Polygon points={toPointsAttr(innerGrid)} fill="none" stroke={colors.border} strokeWidth={1} />
        <Polygon points={toPointsAttr(midGrid)} fill="none" stroke={colors.gray400} strokeWidth={1} />
        <Polygon points={toPointsAttr(outerGrid)} fill="none" stroke={colors.border} strokeWidth={1} />
        {/* 실제 데이터 폴리곤 */}
        <Polygon
          points={toPointsAttr(dataPoints)}
          fill={colors.black}
          fillOpacity={0.12}
          stroke={colors.black}
          strokeWidth={1.5}
        />
        {dataPoints.map(([x, y], i) => (
          <Circle key={`pt-${i}`} cx={x} cy={y} r={2.5} fill={colors.black} />
        ))}
        {/* 축 라벨 */}
        {AXIS_ORDER.map((axis, i) => {
          const angle = -90 + (360 / AXIS_ORDER.length) * i;
          const rad = (angle * Math.PI) / 180;
          const x = center + labelRadius * Math.cos(rad);
          const y = center + labelRadius * Math.sin(rad);
          return (
            <SvgText
              key={axis.tag}
              x={x}
              y={y}
              fontSize={11}
              fontFamily={fonts.medium}
              fill={colors.gray700}
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {axis.label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
});
