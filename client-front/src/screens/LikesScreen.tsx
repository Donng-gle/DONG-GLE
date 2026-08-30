import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, FlatList, StyleSheet, Text, View } from 'react-native';
import { PlaceListItem } from '../api/place';
import { userApi } from '../api/user';
import { PlaceListItemRow } from '../components/PlaceListItemRow';
import { PlaceDetailScreen } from './PlaceDetailScreen';

interface Props {
  onExit: () => void;
}

export function LikesScreen({ onExit }: Props) {
  const [places, setPlaces] = useState<PlaceListItem[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const response = await userApi.getLikes();
      setPlaces(response.places);
    } catch (e) {
      Alert.alert('찜 목록을 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
      setPlaces([]);
    }
  }

  if (selectedId != null) {
    return (
      <PlaceDetailScreen
        placeId={selectedId}
        onExit={() => {
          setSelectedId(null);
          load(); // 상세에서 찜 해제했을 수 있으니 돌아오면 목록 갱신
        }}
      />
    );
  }

  if (places === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>찜한 장소</Text>
      <FlatList
        data={places}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={<Text style={styles.emptyText}>찜한 장소가 없어요.</Text>}
        renderItem={({ item }) => <PlaceListItemRow place={item} onPress={() => setSelectedId(item.id)} />}
      />
      <Button title="닫기" onPress={onExit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 40 },
});
