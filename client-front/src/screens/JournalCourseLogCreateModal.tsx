import { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { PlaceListItem } from '../api/place';
import { uploadApi } from '../api/upload';
import { visitLogApi } from '../api/visitLog';
import { CalendarPicker } from '../components/CalendarPicker';
import { PlusIcon } from '../components/icons';
import { MOCK_ENABLED } from '../mocks/config';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { PlaceMapPickerScreen } from './PlaceMapPickerScreen';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void; // 저장 성공 후 나의 일지 목록 새로고침용
}

// JournalLogCreateModal(장소 1개 기록)과 같은 제약 — server VisitLogCreateRequest.kt 참고
const ONE_LINE_MAX = 100;
const TITLE_MAX = 50;
const WEATHER_MAX = 20;
const MAX_PHOTOS = 5;

interface PlaceFormEntry {
  title: string;
  oneLine: string;
  weather: string;
  assets: ImagePicker.ImagePickerAsset[];
}

function emptyEntry(): PlaceFormEntry {
  return { title: '', oneLine: '', weather: '', assets: [] };
}

function toDateOnly(iso: string) {
  return iso.slice(0, 10);
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function formatDateLabel(dateKey: string) {
  const d = new Date(dateKey + 'T00:00:00');
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${WEEKDAY_LABELS[d.getDay()]})`;
}

// "나의 일지" +에서 "코스 작성"을 골랐을 때 — 장소를 2개 이상 골라(PlaceMapPickerScreen의 지도
// 다중 선택 재사용) 장소마다 JournalLogCreateModal과 같은 카드 화면으로 사진/한줄리뷰/날씨를
// 각각 입력받고, 한 번에 코스(POST /logs/course)로 저장한다. 아직 이 흐름 자체가 Figma 시안에
// 없어서(2026-09-08 결정, decision-log 참고) 기존 기록하기 모달의 시각 스타일만 그대로 재사용한
// 디자인 미반영 버전 — 이 프로젝트 관례대로(feat/place-user-explore-client 등) 기능 먼저 붙이고
// 나중에 디자인 나오면 교체함
export function JournalCourseLogCreateModal({ visible, onClose, onCreated }: Props) {
  // 사용자 요청(2026-09-08)으로 순서 변경: 날짜부터 정하고(코스 전체 공유) → 장소를 고르고 →
  // 장소마다 사진/한줄리뷰/날씨 입력. CalendarPicker는 "직접 일정 만들기-날짜 선택"(Figma
  // 316:4643)의 실제 구현체를 그대로 재사용(CourseManualBuilderScreen/CourseFlowScreen과 동일)
  const [step, setStep] = useState<'date' | 'places' | 'form'>('date');
  const [selectedPlaces, setSelectedPlaces] = useState<PlaceListItem[]>([]);
  const [entries, setEntries] = useState<PlaceFormEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visitedAt, setVisitedAt] = useState(''); // 코스 전체 공유 날짜, YYYY-MM-DD
  const [saving, setSaving] = useState(false);

  function resetAndClose() {
    setStep('date');
    setSelectedPlaces([]);
    setEntries([]);
    setCurrentIndex(0);
    setVisitedAt('');
    onClose();
  }

  function togglePlace(place: PlaceListItem) {
    setSelectedPlaces((prev) =>
      prev.some((p) => p.id === place.id) ? prev.filter((p) => p.id !== place.id) : [...prev, place],
    );
  }

  // PlaceMapPickerScreen은 뒤로가기 화살표와 "완료" 버튼이 둘 다 이 콜백 하나(onExit)를 부름 —
  // 이 화면이 원래 그렇게 설계됨(직접 일정 만들기에서도 동일). 2개 미만이면 계속 고르거나
  // 전체 취소를 고르게 하고, 2개 이상이면 다음 단계로 넘어감
  function handleExitPicker() {
    if (selectedPlaces.length < 2) {
      Alert.alert('장소를 2개 이상 선택해주세요', '코스 기록은 최소 두 곳부터 만들 수 있어요.', [
        { text: '기록 취소', style: 'destructive', onPress: resetAndClose },
        { text: '계속 고르기', style: 'cancel' },
      ]);
      return;
    }
    setEntries(selectedPlaces.map(() => emptyEntry()));
    setCurrentIndex(0);
    setStep('form');
  }

  function updateCurrentEntry(patch: Partial<PlaceFormEntry>) {
    setEntries((prev) => prev.map((e, i) => (i === currentIndex ? { ...e, ...patch } : e)));
  }

  async function pickImageForCurrent() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('사진 접근 권한이 필요해요', '설정에서 사진 보관함 접근을 허용해주세요.');
      return;
    }
    const remaining = MAX_PHOTOS - entries[currentIndex].assets.length;
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
      updateCurrentEntry({ assets: [...entries[currentIndex].assets, ...result.assets].slice(0, MAX_PHOTOS) });
    }
  }

  function removeAssetFromCurrent(index: number) {
    updateCurrentEntry({ assets: entries[currentIndex].assets.filter((_, i) => i !== index) });
  }

  // JournalLogCreateModal.uploadPhoto와 동일한 목업 우회 로직 — mocks/handlers.ts 상단 주석
  // "아직 목업 안 된 것: ... 업로드" 참고
  async function uploadPhoto(asset: ImagePicker.ImagePickerAsset): Promise<string> {
    if (MOCK_ENABLED) return asset.uri;

    const contentType = asset.mimeType ?? 'image/jpeg';
    const filename = asset.fileName ?? `visit-log-${Date.now()}.jpg`;
    const presigned = await uploadApi.getPresignedUrl({ filename, content_type: contentType, purpose: 'visit_log' });
    const file = await fetch(asset.uri).then((r) => r.blob());
    await uploadApi.uploadFile(presigned.upload_url, file, contentType);
    return presigned.file_url;
  }

  async function uploadPhotos(assets: ImagePicker.ImagePickerAsset[]): Promise<string[]> {
    const urls: string[] = [];
    for (const asset of assets) {
      urls.push(await uploadPhoto(asset));
    }
    return urls;
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      const places = await Promise.all(
        selectedPlaces.map(async (place, i) => {
          const entry = entries[i];
          const photoUrls = entry.assets.length > 0 ? await uploadPhotos(entry.assets) : undefined;
          return {
            place_id: place.id,
            photos: photoUrls?.map((url) => ({ url })),
            title: entry.title.trim() || undefined,
            one_line: entry.oneLine.trim() || undefined,
            weather: entry.weather.trim() || undefined,
            visited_at: visitedAt ? `${visitedAt}T00:00:00` : undefined,
          };
        }),
      );
      await visitLogApi.createCourseLog({ places });
      onCreated();
      resetAndClose();
    } catch (e) {
      Alert.alert('코스 기록 작성에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setSaving(false);
    }
  }

  function handleNext() {
    if (currentIndex < entries.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      handleSubmit();
    }
  }

  function handlePrev() {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    } else {
      // 첫 장소 폼에서 "이전"을 누르면 장소 선택으로 되돌아감 — 그때까지 입력한 내용은 버려짐
      // (장소 구성 자체를 바꿀 수 있어서 entries와 selectedPlaces 정합을 다시 맞추기보다 간단하게 처리)
      setStep('places');
    }
  }

  if (!visible) return null;

  if (step === 'date') {
    return (
      <CalendarPicker
        visible
        value={visitedAt || toDateOnly(new Date().toISOString())}
        onClose={resetAndClose}
        onConfirm={(date) => {
          setVisitedAt(date);
          setStep('places');
        }}
      />
    );
  }

  if (step === 'places') {
    return (
      <Modal visible transparent={false} animationType="slide" onRequestClose={resetAndClose}>
        <PlaceMapPickerScreen onExit={handleExitPicker} selectedPlaces={selectedPlaces} onTogglePlace={togglePlace} />
      </Modal>
    );
  }

  const place = selectedPlaces[currentIndex];
  const entry = entries[currentIndex];
  const isLast = currentIndex === entries.length - 1;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={resetAndClose}>
      <Pressable style={styles.backdrop} onPress={() => {}}>
        <Pressable style={styles.card} onPress={() => {}}>
          <ScrollView contentContainerStyle={styles.cardContent} keyboardShouldPersistTaps="handled">
            <View style={styles.progressRow}>
              <Text style={styles.progressText}>
                {currentIndex + 1} / {entries.length} · {place.name}
              </Text>
            </View>

            <View style={styles.titleRow}>
              <TextInput
                style={styles.titleInput}
                value={entry.title}
                onChangeText={(v) => updateCurrentEntry({ title: v })}
                placeholder="제목을 입력하세요"
                placeholderTextColor={colors.black}
                maxLength={TITLE_MAX}
              />
              <Text style={styles.pencilIcon}>✏️</Text>
            </View>

            {entry.assets.length === 0 ? (
              <TouchableOpacity style={styles.photoBox} onPress={pickImageForCurrent} activeOpacity={0.8}>
                <PlusIcon />
              </TouchableOpacity>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.photoRow}
                contentContainerStyle={styles.photoRowContent}
              >
                {entry.assets.map((a, index) => (
                  <View key={a.assetId ?? a.uri} style={styles.photoThumbBox}>
                    <Image source={{ uri: a.uri }} style={styles.photoPreview} resizeMode="cover" />
                    <TouchableOpacity style={styles.photoRemoveBadge} onPress={() => removeAssetFromCurrent(index)} hitSlop={6}>
                      <Text style={styles.photoRemoveIcon}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {entry.assets.length < MAX_PHOTOS && (
                  <TouchableOpacity style={styles.photoAddTile} onPress={pickImageForCurrent} activeOpacity={0.8}>
                    <PlusIcon />
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}

            <View style={styles.textarea}>
              <TextInput
                style={styles.textareaInput}
                value={entry.oneLine}
                onChangeText={(v) => updateCurrentEntry({ oneLine: v })}
                placeholder="여행에서 즐거웠던 추억을 기록하세요."
                placeholderTextColor={colors.gray500}
                maxLength={ONE_LINE_MAX}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.counter}>
                {entry.oneLine.length}/{ONE_LINE_MAX}
              </Text>
            </View>

            {/* 날짜는 코스 전체가 공유 — 앞 단계(step 'date')에서 이미 정했으므로 여기선 읽기 전용
                표시만(2026-09-08 결정, decision-log 참고) */}
            <View style={styles.fieldBox}>
              <Text style={styles.fieldValue}>{formatDateLabel(visitedAt)}</Text>
            </View>

            <View style={styles.fieldBox}>
              <TextInput
                style={styles.fieldInput}
                value={entry.weather}
                onChangeText={(v) => updateCurrentEntry({ weather: v })}
                placeholder="날씨를 입력해주세요"
                placeholderTextColor={colors.gray500}
                maxLength={WEATHER_MAX}
              />
            </View>
          </ScrollView>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={handlePrev} disabled={saving}>
              <Text style={styles.cancelText}>{currentIndex === 0 ? '장소 다시 고르기' : '이전'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={handleNext} disabled={saving}>
              <Text style={styles.confirmText}>{saving ? '저장 중...' : isLast ? '완료' : '다음'}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17,17,17,0.5)', alignItems: 'center', justifyContent: 'center' },
  card: { width: '80%', maxHeight: '85%', backgroundColor: colors.white, borderRadius: 8, overflow: 'hidden' },
  cardContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 },
  progressRow: { marginBottom: 8 },
  progressText: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: -0.3, color: colors.accentBlue },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  titleInput: { flex: 1, fontFamily: fonts.semiBold, fontSize: 20, letterSpacing: -0.5, color: colors.black, padding: 0 },
  pencilIcon: { fontSize: 16 },
  photoBox: {
    height: 144,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  photoPreview: { width: '100%', height: '100%' },
  photoRow: { height: 144, marginBottom: 12 },
  photoRowContent: { gap: 8 },
  photoThumbBox: { width: 144, height: 144, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.border },
  photoRemoveBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(17,17,17,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveIcon: { color: colors.white, fontSize: 14, lineHeight: 16 },
  photoAddTile: {
    width: 144,
    height: 144,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textarea: { height: 144, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 16, marginBottom: 12 },
  textareaInput: { flex: 1, fontFamily: fonts.regular, fontSize: 12, letterSpacing: -0.3, color: colors.black, padding: 0 },
  counter: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray500, textAlign: 'right' },
  fieldBox: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    marginBottom: 12,
  },
  fieldInput: { fontFamily: fonts.regular, fontSize: 12, letterSpacing: -0.3, color: colors.black, padding: 0 },
  fieldValue: { fontFamily: fonts.regular, fontSize: 12, letterSpacing: -0.3, color: colors.black },
  buttonRow: { flexDirection: 'row', height: 44, borderTopWidth: 1, borderTopColor: colors.border },
  cancelButton: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: colors.border },
  cancelText: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: -0.3, color: colors.gray500 },
  confirmButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  confirmText: { fontFamily: fonts.semiBold, fontSize: 12, letterSpacing: -0.3, color: colors.accentBlue },
});
