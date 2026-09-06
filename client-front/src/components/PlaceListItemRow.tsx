import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PlaceListItem } from '../api/place';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

interface Props {
  place: PlaceListItem;
  onPress: () => void;
}

// 장소 목록/찜 목록 등에서 공통으로 쓰는 한 줄 카드
export function PlaceListItemRow({ place, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      {place.main_image_url ? (
        <Image source={{ uri: place.main_image_url }} style={styles.thumbnail} resizeMode="cover" />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder]} />
      )}
      <View style={styles.info}>
        <Text style={styles.name}>{place.name}</Text>
        <Text style={styles.meta}>
          {place.category}
          {place.addr1 ? ` · ${place.addr1}` : ''}
        </Text>
        {place.tags.length > 0 && <Text style={styles.tags}>{place.tags.join(' · ')}</Text>}
      </View>
      {place.is_liked && <Text style={styles.likedMark}>♥</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  thumbnail: { width: 64, height: 64, borderRadius: 12, marginRight: 12 },
  thumbnailPlaceholder: { backgroundColor: colors.border },
  info: { flex: 1 },
  name: { fontFamily: fonts.medium, fontSize: 15, letterSpacing: -0.4, color: colors.black },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray500, marginTop: 2 },
  tags: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray500, marginTop: 2 },
  likedMark: { fontSize: 16, color: colors.black, marginLeft: 8 },
});
