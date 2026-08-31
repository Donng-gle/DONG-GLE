import { useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { VisitLogMapItem, visitLogApi } from '../api/visitLog';

interface Props {
  log: VisitLogMapItem;
  onSaved: () => void;
  onDeleted: () => void;
  onCancel: () => void;
}

export function LogEditScreen({ log, onSaved, onDeleted, onCancel }: Props) {
  const [oneLine, setOneLine] = useState(log.one_line ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await visitLogApi.update(log.id, { one_line: oneLine.trim() || undefined });
      onSaved();
    } catch (e) {
      Alert.alert('수정에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert('기록을 삭제할까요?', undefined, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: handleDelete },
    ]);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await visitLogApi.remove(log.id);
      onDeleted();
    } catch (e) {
      Alert.alert('삭제에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
      setDeleting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{log.place_name}</Text>
      <Text style={styles.meta}>{log.visited_at.slice(0, 10)}</Text>

      <Text style={styles.label}>한줄리뷰</Text>
      <TextInput style={styles.input} value={oneLine} onChangeText={setOneLine} maxLength={100} multiline />

      <View style={styles.actions}>
        <Button title={saving ? '저장 중...' : '저장'} onPress={handleSave} disabled={saving || deleting} />
        <View style={styles.gap} />
        <Button title={deleting ? '삭제 중...' : '삭제'} color="#d33" onPress={confirmDelete} disabled={saving || deleting} />
        <View style={styles.gap} />
        <Button title="닫기" onPress={onCancel} disabled={saving || deleting} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 32 },
  title: { fontSize: 20, fontWeight: '700' },
  meta: { fontSize: 13, color: '#999', marginTop: 4, marginBottom: 24 },
  label: { fontSize: 13, color: '#666', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actions: { marginTop: 32 },
  gap: { height: 12 },
});
