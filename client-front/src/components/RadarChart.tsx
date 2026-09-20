import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

// 감성태그 7개 대분류(ssot.md) — 화면에 항상 이 순서/이 7개로 축을 그림(응답 순서가 뒤섞이거나
// 일부만 와도 축이 흔들리지 않게).
//
// Figma "마이페이지"(598:13735, 채널 btctpix3, 2026-09-12 재실측) 대조 결과 기존 구현이 여러 곳에서
// 어긋나 있었음(사용자 리포트 — 스크린샷 첨부):
// - 라벨: 짧은 한글 요약("여유"/"활기" 등)을 임의로 붙여뒀었는데, 실제 시안은 태그 키 그대로
//   영문("Relaxing"/"Lively" 등)을 씀 — 그대로 맞춤
// - 축 순서: 로컬/포토제닉/전통 세 축 순서가 시안과 달랐음(라벨 좌표 각도 역산으로 확인) —
//   relaxing→lively→romantic→photogenic→traditional→local→modern이 실제 시계방향 순서
// - 색: 데이터 폴리곤/점 마커가 검정이었는데 시안은 파랑(#0066ff, colors.accentBlue) — 이 화면
//   전체가 흑백 톤인데 이 그래프에서만 유일하게 파란색을 씀(PlaceDetailScreen과 동일한 예외 패턴)
// - 점 마커: 꽉 찬 검정 원이었는데 시안은 흰 배경+파란 테두리 원(지름 6)
const AXIS_ORDER: { tag: string; label: string }[] = [
  { tag: 'relaxing', label: 'Relaxing' },
  { tag: 'lively', label: 'Lively' },
  { tag: 'romantic', label: 'Romantic' },
  { tag: 'photogenic', label: 'Photogenic' },
  { tag: 'traditional', label: 'Traditional' },
  { tag: 'local', label: 'Local' },
  { tag: 'modern', label: 'Modern' },
];

// 그리드 링 4겹 — Figma Polygon 1~4(598:13777~598:13780) 실측 반지름(119.5/95.5/68.5/39.5)의
// 비율 그대로. 균등한 25/50/75/100%가 아니라 바깥쪽일수록 간격이 좁아지는 값이라, 데이터를
// 나타내는 의미 있는 눈금이라기보다 장식용 배경 그리드로 보임(4겹 다 시안에서 같은 연회색
// 테두리라 특정 링을 강조하지 않음 — 기존엔 0.5 중립 기준선 링만 따로 진하게 칠했었는데 시안엔
// 그런 구분이 없어서 제거)
const GRID_RATIOS = [0.33, 0.57, 0.8, 1];

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

// size=320: 처음엔 "폴리곤 지름/프레임폭(360)" 비율(0.332)로 계산했는데, 이건 분모가 화면
// 전체 폭이라 그래프 카드 안에서 실제로 차지하는 비중보다 작게 나오는 잘못된 기준이었음
// (2026-09-12, 사용자가 "피그마에 있는 비율이랑 똑같게" 키워달라고 재요청하면서 재확인) —
// Figma에서 카드/버튼 등 이 화면 콘텐츠가 실제로 쓰는 폭은 360 프레임 안에서 좌우 20px 여백을
// 뺀 320("취향 재검사" 기본버튼 실측 폭이 정확히 320)이 기준. size를 그 320에 맞추면 아래
// radius/labelRadius도 Figma 원본 실측값(119.5 / ~137)과 거의 그대로 dp 단위로 일치함
// (TimePicker 때와 같은 결론 — 360 기준 카드가 이미 320이라 우리 값과 스케일 없이 맞음)
export function RadarChart({ data, size = 320 }: Props) {
  const center = size / 2;
  // Figma 실측: 폴리곤 반지름 119.5 / 콘텐츠폭 320 ≈ 0.373
  const radius = size * 0.373;
  // Figma 실측: 라벨 중심까지 평균 거리 ≈ 137, radius(119.5) 대비 ≈ 1.15배
  const labelRadius = radius * 1.15;

  const scoreByTag = new Map(data.map((d) => [d.tag, d.score]));
  const values = AXIS_ORDER.map((a) => scoreByTag.get(a.tag) ?? 0.5);

  const dataPoints = AXIS_ORDER.map((_, i) => {
    const angle = -90 + (360 / AXIS_ORDER.length) * i;
    const rad = (angle * Math.PI) / 180;
    const r = radius * Math.max(0, Math.min(1, values[i]));
    return [center + r * Math.cos(rad), center + r * Math.sin(rad)] as [number, number];
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* 축선 (중심 -> 각 꼭짓점) */}
        {pointsOnAxes(center, radius, 1).map(([x, y], i) => (
          <Line key={`axis-${i}`} x1={center} y1={center} x2={x} y2={y} stroke={colors.border} strokeWidth={1} />
        ))}
        {/* 그리드 링 4겹 — 전부 동일한 연회색(시안엔 특정 링 강조 없음) */}
        {GRID_RATIOS.map((ratio) => (
          <Polygon
            key={`grid-${ratio}`}
            points={toPointsAttr(pointsOnAxes(center, radius, ratio))}
            fill="none"
            stroke={colors.border}
            strokeWidth={1}
          />
        ))}
        {/* 실제 데이터 폴리곤 — 이 화면에서 유일하게 파란색을 쓰는 요소(Figma 실측) */}
        <Polygon
          points={toPointsAttr(dataPoints)}
          fill={colors.accentBlue}
          fillOpacity={0.15}
          stroke={colors.accentBlue}
          strokeWidth={1.5}
        />
        {dataPoints.map(([x, y], i) => (
          <Circle key={`pt-${i}`} cx={x} cy={y} r={3} fill={colors.white} stroke={colors.accentBlue} strokeWidth={1.5} />
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
              fontSize={12}
              fontFamily={fonts.regular}
              fill={colors.gray500}
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
