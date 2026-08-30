import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PlaceListItem } from '../api/place';

interface Props {
  place: PlaceListItem;
  onPress: () => void;
}

// 장소 목록/찜 목록 등에서 공통으로 쓰는 한 줄 카드. 디자인 시안 전이라 최소한의 정보만 표시
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
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  thumbnail: { width: 56, height: 56, borderRadius: 8, marginRight: 12 },
  thumbnailPlaceholder: { backgroundColor: '#eee' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12, color: '#999', marginTop: 2 },
  tags: { fontSize: 12, color: '#ff5a5f', marginTop: 2 },
  likedMark: { fontSize: 16, color: '#ff5a5f', marginLeft: 8 },
});
