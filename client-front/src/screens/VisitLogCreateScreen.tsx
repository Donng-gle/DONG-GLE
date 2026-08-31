import { useState } from 'react';
import { Alert, Button, Image, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadApi } from '../api/upload';
import { visitLogApi } from '../api/visitLog';

interface Props {
  placeId: number;
  placeName: string;
  onDone: () => void;
  onCancel: () => void;
}

// photo_url이 옵셔널이라(server VisitLogCreateRequest.kt 참고) 사진 없이 한줄리뷰만으로도 작성 가능.
// 사진을 고르면 presigned URL 발급 → S3 PUT 업로드 → 반환된 file_url을 photo_url로 사용
export function VisitLogCreateScreen({ placeId, placeName, onDone, onCancel }: Props) {
  const [oneLine, setOneLine] = useState('');
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('사진 접근 권한이 필요해요', '설정에서 사진 보관함 접근을 허용해주세요.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets.length > 0) {
      setAsset(result.assets[0]);
    }
  }

  async function uploadPhoto(): Promise<string> {
    if (!asset) throw new Error('사진이 선택되지 않았어요.');

    const contentType = asset.mimeType ?? 'image/jpeg';
    const filename = asset.fileName ?? `visit-log-${Date.now()}.jpg`;

    const presigned = await uploadApi.getPresignedUrl({
      filename,
      content_type: contentType,
      purpose: 'visit_log',
    });

    const file = await fetch(asset.uri).then((r) => r.blob());
    await uploadApi.uploadFile(presigned.upload_url, file, contentType);

    return presigned.file_url;
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      const photoUrl = asset ? await uploadPhoto() : undefined;
      await visitLogApi.create(placeId, { photo_url: photoUrl, one_line: oneLine.trim() || undefined });
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

      <Text style={styles.label}>사진 (선택)</Text>
      {asset ? (
        <View>
          <Image source={{ uri: asset.uri }} style={styles.preview} resizeMode="cover" />
          <Button title="사진 제거" onPress={() => setAsset(null)} disabled={saving} />
        </View>
      ) : (
        <Button title="사진 선택" onPress={pickImage} disabled={saving} />
      )}

      <Text style={[styles.label, styles.labelSpaced]}>한줄리뷰 (선택, 최대 100자)</Text>
      <TextInput
        style={styles.input}
        value={oneLine}
        onChangeText={setOneLine}
        placeholder="오늘 이곳은 어땠나요?"
        maxLength={100}
        multiline
      />

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
  labelSpaced: { marginTop: 20 },
  preview: { width: '100%', height: 180, borderRadius: 12, marginBottom: 8, backgroundColor: '#eee' },
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
