import { useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { visitLogApi } from '../api/visitLog';

interface Props {
  placeId: number;
  placeName: string;
  onDone: () => void;
  onCancel: () => void;
}

// 사진 첨부는 아직 미지원 — expo-image-picker 도입 후 photo_url 필드 연결 예정 (visitLog.ts 참고).
// photo_url이 옵셔널이라 한줄리뷰만으로도 기록 작성 자체는 완성된 기능임.
export function VisitLogCreateScreen({ placeId, placeName, onDone, onCancel }: Props) {
  const [oneLine, setOneLine] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    try {
      await visitLogApi.create(placeId, { one_line: oneLine.trim() || undefined });
      onDone();
    } catch (e) {
      Alert.alert('기록 작성에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>방문 기록 남기기</Text>
      <Text style={styles.placeName}>{placeName}</Text>

      <Text style={styles.label}>한줄리뷰 (선택, 최대 100자)</Text>
      <TextInput
        style={styles.input}
        value={oneLine}
        onChangeText={setOneLine}
        placeholder="오늘 이곳은 어땠나요?"
        maxLength={100}
        multiline
      />
      <Text style={styles.hint}>사진 첨부는 아직 준비 중이에요.</Text>

      <View style={styles.actions}>
        <Button title={saving ? '저장 중...' : '기록 저장'} onPress={handleSubmit} disabled={saving} />
        <View style={styles.gap} />
        <Button title="취소" onPress={onCancel} disabled={saving} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 32 },
  title: { fontSize: 22, fontWeight: '700' },
  placeName: { fontSize: 14, color: '#666', marginTop: 4, marginBottom: 24 },
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
  hint: { fontSize: 12, color: '#999', marginTop: 8 },
  actions: { marginTop: 32 },
  gap: { height: 12 },
});
