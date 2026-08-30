import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, FlatList, StyleSheet, Text, View } from 'react-native';
import { TagItem, tagApi } from '../api/tag';

interface Props {
  onExit: () => void;
}

export function TagsScreen({ onExit }: Props) {
  const [tags, setTags] = useState<TagItem[] | null>(null);

  useEffect(() => {
    tagApi
      .list()
      .then((response) => setTags(response.tags))
      .catch((e) => {
        Alert.alert('태그 목록을 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류');
        setTags([]);
      });
  }, []);

  if (tags === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>감성 태그 안내</Text>
      <FlatList
        data={tags}
        keyExtractor={(item) => item.tag}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        )}
      />
      <Button title="닫기" onPress={onExit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  label: { fontSize: 15, fontWeight: '700' },
  description: { fontSize: 13, color: '#666', marginTop: 4 },
});
