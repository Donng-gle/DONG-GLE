import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  rating: number; // 0~5. 표시 전용일 땐 평균(소수 가능)도 들어올 수 있어서 반올림해서 그림
  size?: number;
  color?: string;
  // 있으면 탭해서 별점을 고르는 입력 모드, 없으면 읽기 전용 표시 모드
  onChange?: (value: number) => void;
}

const STAR_COUNT = 5;

// 별점 입력(작성 화면)과 표시(장소 상세, 리뷰 카드)에서 공통으로 씀 — SVG 없이 문자 ★/☆로 표현.
// 평균 별점처럼 소수가 들어오면 가장 가까운 정수로 반올림해서 채워진 별 개수를 결정함(반쪽 별 없음)
export function StarRating({ rating, size = 18, color = colors.black, onChange }: Props) {
  const filledCount = Math.round(rating);
  const interactive = onChange != null;

  return (
    <View style={styles.row}>
      {Array.from({ length: STAR_COUNT }, (_, i) => i + 1).map((value) => {
        const filled = value <= filledCount;
        const star = (
          <Text key={value} style={[styles.star, { fontSize: size, color: filled ? color : colors.border }]}>
            {filled ? '★' : '☆'}
          </Text>
        );
        if (!interactive) return star;
        return (
          <TouchableOpacity key={value} onPress={() => onChange(value)} hitSlop={4}>
            {star}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
  star: {},
});
