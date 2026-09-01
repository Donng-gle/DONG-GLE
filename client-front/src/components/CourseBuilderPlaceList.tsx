import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

export interface CourseBuilderPlaceItem {
  placeId: number;
  name: string;
}

interface Props {
  items: CourseBuilderPlaceItem[];
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (index: number) => void;
}

// 코스 직접 만들기 / 코스 수정 화면에서 공용으로 쓰는 장소 순서 편집 목록.
// 드래그 대신 위/아래 버튼으로 순서 변경
export function CourseBuilderPlaceList({ items, onMoveUp, onMoveDown, onRemove }: Props) {
  if (items.length === 0) {
    return <Text style={styles.emptyText}>아직 추가한 장소가 없어요</Text>;
  }

  return (
    <View>
      {items.map((item, index) => (
        <View key={item.placeId} style={styles.row}>
          <View style={styles.order}>
            <Text style={styles.orderText}>{index + 1}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.controls}>
            <TouchableOpacity onPress={() => onMoveUp(index)} disabled={index === 0} style={styles.controlButton}>
              <Text style={[styles.controlText, index === 0 && styles.controlDisabled]}>▲</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onMoveDown(index)}
              disabled={index === items.length - 1}
              style={styles.controlButton}
            >
              <Text style={[styles.controlText, index === items.length - 1 && styles.controlDisabled]}>▼</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onRemove(index)} style={styles.controlButton}>
              <Text style={styles.removeText}>삭제</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyText: { fontFamily: fonts.regular, fontSize: 13, color: colors.gray500, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  order: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  orderText: { fontFamily: fonts.semiBold, fontSize: 11, color: colors.white },
  name: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.black },
  controls: { flexDirection: 'row', gap: 14 },
  controlButton: { paddingHorizontal: 2 },
  controlText: { fontSize: 14, color: colors.black },
  controlDisabled: { color: colors.border },
  removeText: { fontFamily: fonts.regular, fontSize: 13, color: colors.gray500 },
});
