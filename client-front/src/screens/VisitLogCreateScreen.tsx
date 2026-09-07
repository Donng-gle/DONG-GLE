import { useState } from 'react';
import { Alert, Button, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadApi } from '../api/upload';
import { visitLogApi } from '../api/visitLog';
import { StarRating } from '../components/StarRating';
import { MOCK_ENABLED } from '../mocks/config';

interface Props {
  placeId: number;
  placeName: string;
  onDone: () => void;
  onCancel: () => void;
}

// 여러 장 지원(2026-09-06 결정, decision-log 참고, JournalLogCreateModal과 동일한 상한)
const MAX_PHOTOS = 5;

// photo_urls가 옵셔널이라(server VisitLogCreateRequest.kt 참고) 사진 없이 한줄리뷰만으로도 작성
// 가능. 사진마다 presigned URL 발급 → S3 PUT 업로드 → 반환된 file_url들을 photo_urls로 사용
export function VisitLogCreateScreen({ placeId, placeName, onDone, onCancel }: Props) {
  const [oneLine, setOneLine] = useState('');
  const [rating, setRating] = useState(0); // 0 = 선택 안 함(선택 입력이라 0은 "미평가"로 취급, 서버엔 안 보냄)
  const [assets, setAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [saving, setSaving] = useState(false);

  // legacy:true — 기본 Android 피커가 "포토 라이브러리" 범위로만 스캔해서 기기 로컬 갤러리가 안
  // 보이던 문제 수정(2026-09-06, JournalLogCreateModal과 동일)
  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('사진 접근 권한이 필요해요', '설정에서 사진 보관함 접근을 허용해주세요.');
      return;
    }
    const remaining = MAX_PHOTOS - assets.length;
    if (remaining <= 0) {
      Alert.alert(`사진은 최대 ${MAX_PHOTOS}장까지 첨부할 수 있어요.`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      legacy: true,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });
    if (!result.canceled && result.assets.length > 0) {
      setAssets((prev) => [...prev, ...result.assets].slice(0, MAX_PHOTOS));
    }
  }

  function removeAsset(index: number) {
    setAssets((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadPhoto(asset: ImagePicker.ImagePickerAsset): Promise<string> {
    // 목업 모드에선 업로드 자체가 아직 목업 처리가 안 돼 있고(mocks/handlers.ts 상단 주석 참고),
    // uploadApi.uploadFile은 apiClient를 안 거치고 fetch를 직접 호출해서 MOCK_ENABLED여도 항상
    // 실제 네트워크로 나가버려 실패함(2026-09-06 발견, JournalLogCreateModal과 동일 버그) —
    // 로컬 사진 uri를 그대로 photo_urls 항목으로 씀
    if (MOCK_ENABLED) return asset.uri;

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

  // 선택 순서 그대로 업로드해서 photo_urls 배열 순서(=노출 순서)를 지킴 — Promise.all은 병렬이라
  // 완료 순서가 뒤섞일 수 있어서 순차 처리(JournalLogCreateModal.uploadPhotos와 동일)
  async function uploadPhotos(): Promise<string[]> {
    const urls: string[] = [];
    for (const asset of assets) {
      urls.push(await uploadPhoto(asset));
    }
    return urls;
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      const photoUrls = assets.length > 0 ? await uploadPhotos() : undefined;
      await visitLogApi.create(placeId, {
        photo_urls: photoUrls,
        one_line: oneLine.trim() || undefined,
        rating: rating > 0 ? rating : undefined,
      });
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

      <Text style={styles.label}>사진 (선택, 여러 장 가능)</Text>
      {assets.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
          {assets.map((a, index) => (
            <View key={a.assetId ?? a.uri} style={styles.photoThumbWrap}>
              <Image source={{ uri: a.uri }} style={styles.preview} resizeMode="cover" />
              <Button title="제거" onPress={() => removeAsset(index)} disabled={saving} />
            </View>
          ))}
        </ScrollView>
      )}
      {assets.length < MAX_PHOTOS && (
        <Button title="사진 선택" onPress={pickImage} disabled={saving} />
      )}

      <Text style={[styles.label, styles.labelSpaced]}>별점 (선택)</Text>
      <StarRating rating={rating} size={28} onChange={setRating} />

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
  preview: { width: 160, height: 160, borderRadius: 12, marginBottom: 4, backgroundColor: '#eee' },
  // 여러 장 지원(2026-09-06 결정, decision-log 참고)
  photoRow: { marginBottom: 8 },
  photoThumbWrap: { marginRight: 12, alignItems: 'center' },
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
