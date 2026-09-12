import { useEffect, useState } from 'react';
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
import { VisitLogMapItem, VisitLogPhoto, visitLogApi } from '../api/visitLog';
import { CalendarPicker } from '../components/CalendarPicker';
import { PencilIcon, PlusIcon } from '../components/icons';
import { MOCK_ENABLED } from '../mocks/config';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { PlaceListScreen } from './PlaceListScreen';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void; // 저장 성공 후 나의 일지 목록 새로고침용
  // 나의 일지 카드를 눌렀을 때 이 값을 주면 같은 프레임을 "수정" 모드로 재사용함(2026-09-12,
  // 사용자 요청 — 기존엔 이 화면 따로, 수정용 LogEditScreen 따로 있었는데 새 디자인 없이 이
  // "기록하기" 프레임 그대로 재사용해서 수정하는 쪽으로 통일). 사진/장소도 편집 가능(같은 날
  // 후속 요청으로 VisitLogUpdateRequest에 photos/placeId 추가, server 참고)
  editLog?: VisitLogMapItem;
  onUpdated?: () => void;
  onDeleted?: () => void;
}

// 백엔드 VisitLogCreateRequest.oneLine엔 @Size(max=100) 제약이 있는데(server-back
// VisitLogCreateRequest.kt 참고) Figma 시안(593:12613)의 글자수 표시는 "0/200" — 시안이 백엔드
// 확정 전에 만들어진 걸로 보여서, 실제로 저장 가능한 100을 기준으로 함(200으로 두면 101자 이상
// 입력 시 저장이 400으로 실패하는 버그가 됨). 2026-09-05 결정
const ONE_LINE_MAX = 100;
const TITLE_MAX = 50;
const WEATHER_MAX = 20;

// 여러 장 지원(2026-09-06 결정, decision-log 참고). 백엔드 VisitLogCreateRequest.photoUrls는
// @Size(max=10)까지 받지만, 한 번에 고를 사진 개수를 UX상 적당히 제한하려고 5로 둠(Figma 시안엔
// 여러 장 선택 자체가 없어서 임의 값 — 필요하면 나중에 조정)
const MAX_PHOTOS = 5;

function toDateOnly(iso: string) {
  return iso.slice(0, 10); // YYYY-MM-DD
}

// Figma 노드 593:12613("메인 페이지-나의 일지-기록하기") 실측값 그대로 구현(2026-09-05).
// 반투명 배경 위에 흰 카드 하나가 뜨는 구조 — 카드 안 요소 간 세로 간격이 전부 12로 통일돼
// 있어서(사진→설명→날짜→장소→날씨→버튼) 그대로 반영. VisitLog에 title/weather 컬럼이 없어서
// (2026-09-05 사용자 확인 후 백엔드에 컬럼 추가부터 진행, decision-log 참고) 이 화면 구현과
// 같이 스키마를 확장함. "+"가 특정 장소 상세가 아니라 메인 나의 일지 탭에서 눌려서 장소를 미리
// 모르므로, "장소를 입력해주세요" 칸은 PlaceListScreen을 선택 모드(onSelectPlace)로 열어서 검색
export function JournalLogCreateModal({
  visible,
  onClose,
  onCreated,
  editLog,
  onUpdated,
  onDeleted,
}: Props) {
  const [title, setTitle] = useState('');
  const [oneLine, setOneLine] = useState('');
  const [weather, setWeather] = useState('');
  const [visitedAt, setVisitedAt] = useState(''); // YYYY-MM-DD, 빈 값이면 미선택
  const [place, setPlace] = useState<PlaceListItem | null>(null);
  // 새로 고른(아직 서버에 없는) 사진. 수정 모드에서 기존 사진과 구분해서 따로 들고 있다가 저장
  // 시점에 업로드 URL로 합쳐서 보냄(아래 handleConfirm 참고)
  const [assets, setAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  // 수정 모드 전용 — 서버에 이미 있는 사진(제거는 가능, 순서 변경은 미지원). 생성 모드에선 항상 빈 배열
  const [existingPhotos, setExistingPhotos] = useState<VisitLogPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showPlacePicker, setShowPlacePicker] = useState(false);

  // 모달이 열릴 때마다(visible이 true로 바뀔 때) editLog 기준으로 필드를 다시 채움 — TimePicker에서
  // 겪었던 것과 같은 이유로 visible을 의존성에 넣음(모달은 visible=false여도 마운트 상태가 유지되는
  // 게 RN 공통 동작이라, 마운트 시 1회성 초기화로는 두 번째 열 때부터 이전 값이 남음, 2026-09-12)
  useEffect(() => {
    if (!visible) return;
    if (editLog) {
      setTitle(editLog.title ?? '');
      setOneLine(editLog.one_line ?? '');
      setWeather(editLog.weather ?? '');
      setVisitedAt(toDateOnly(editLog.visited_at));
      setExistingPhotos(editLog.photos);
      setAssets([]);
      // PlaceListItem 전체 모양이 필요하지만 VisitLogMapItem엔 place_id/place_name/lat/lng밖에
      // 없음 — 나머지 필드(카테고리/사진/태그 등)는 이 화면에서 안 쓰이므로(장소칸엔 이름만 표시,
      // 저장 시엔 id만 사용) 빈 값으로 채운 자리표시자 객체를 만듦. 사용자가 실제로 장소를 바꾸면
      // PlaceListScreen에서 고른 진짜 객체로 덮어써짐
      setPlace({
        id: editLog.place_id,
        name: editLog.place_name,
        category: '',
        main_image_url: null,
        addr1: null,
        lat: editLog.lat,
        lng: editLog.lng,
        tags: [],
        is_liked: false,
      });
    } else {
      setTitle('');
      setOneLine('');
      setWeather('');
      setVisitedAt('');
      setPlace(null);
      setAssets([]);
      setExistingPhotos([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editLog]);

  function resetAndClose() {
    setTitle('');
    setOneLine('');
    setWeather('');
    setVisitedAt('');
    setPlace(null);
    setAssets([]);
    setExistingPhotos([]);
    onClose();
  }

  // legacy:true — 기본(legacy:false) Android 피커는 "포토 라이브러리" 범위로만 스캔해서 기기
  // 로컬 갤러리(다운로드, 다른 앱이 저장한 사진 등)가 안 보이던 문제가 있었음(2026-09-06 사용자
  // 리포트, expo-image-picker 문서: legacy는 "포토 라이브러리 밖" 미디어도 선택 가능하게 함)
  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('사진 접근 권한이 필요해요', '설정에서 사진 보관함 접근을 허용해주세요.');
      return;
    }
    const remaining = MAX_PHOTOS - assets.length - existingPhotos.length;
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
      // 이미 골라둔 사진에 이어서 추가(다시 열 때마다 전체를 다시 고를 필요 없게). 수정 모드에선
      // 기존 사진(existingPhotos) 자리도 같이 차지하므로 그만큼 빼고 자름
      setAssets((prev) => [...prev, ...result.assets].slice(0, MAX_PHOTOS - existingPhotos.length));
    }
  }

  function removeAsset(index: number) {
    setAssets((prev) => prev.filter((_, i) => i !== index));
  }

  function removeExistingPhoto(index: number) {
    setExistingPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadPhoto(asset: ImagePicker.ImagePickerAsset): Promise<string> {
    // 목업 모드(EXPO_PUBLIC_USE_MOCK=true)에선 presigned URL 발급/S3 업로드 자체가 아직 목업
    // 처리가 안 돼 있음(mocks/handlers.ts 상단 주석 "아직 목업 안 된 것: ... 업로드" 참고).
    // uploadApi.uploadFile은 apiClient를 안 거치고 fetch를 직접 호출해서 MOCK_ENABLED여도
    // 항상 실제 네트워크로 나가버려 실패함(2026-09-06 사용자 리포트로 발견) — 로컬 사진 uri를
    // 그대로 photo_urls 항목으로 써서 업로드 자체를 건너뜀(Image가 로컬 uri도 그대로 렌더링하므로
    // 화면상 차이 없음)
    if (MOCK_ENABLED) return asset.uri;

    const contentType = asset.mimeType ?? 'image/jpeg';
    const filename = asset.fileName ?? `visit-log-${Date.now()}.jpg`;
    const presigned = await uploadApi.getPresignedUrl({ filename, content_type: contentType, purpose: 'visit_log' });
    const file = await fetch(asset.uri).then((r) => r.blob());
    await uploadApi.uploadFile(presigned.upload_url, file, contentType);
    return presigned.file_url;
  }

  // 여러 장을 선택한 순서 그대로 업로드해서 photo_urls 배열 순서(=노출 순서, 2026-09-06 결정,
  // decision-log 참고)를 지킴 — Promise.all은 병렬이라 완료 순서가 뒤섞일 수 있어서 순차 처리
  async function uploadPhotos(): Promise<string[]> {
    const urls: string[] = [];
    for (const asset of assets) {
      urls.push(await uploadPhoto(asset));
    }
    return urls;
  }

  async function handleConfirm() {
    if (editLog) {
      setSaving(true);
      try {
        // 새로 고른 사진만 업로드하고, 기존에 남겨둔 사진(existingPhotos, 삭제된 건 이미 빠져있음)
        // 뒤에 이어붙여서 photos를 "완전히 교체"하는 형태로 보냄(server VisitLogUpdateRequest.photos
        // 참고 — 부분 수정이 아니라 통째로 교체하는 계약)
        const newPhotoUrls = assets.length > 0 ? await uploadPhotos() : [];
        const photos = [
          ...existingPhotos.map((p) => ({ url: p.url, caption: p.caption ?? undefined })),
          ...newPhotoUrls.map((url) => ({ url })),
        ];
        // title/one_line/weather는 빈 문자열이어도 그대로 보냄 — 서버가 빈 문자열을 "지움"으로
        // 해석해서 null로 저장함(VisitLogService.kt 참고). 필드를 생략하면 "안 건드림"으로 해석돼서
        // 지운 게 반영 안 되는 버그가 됨(LogEditScreen.tsx에서 one_line에 대해 이미 한 번 발견된
        // 패턴 — 여기선 title/weather도 같이 편집하므로 셋 다 동일하게 처리)
        await visitLogApi.update(editLog.id, {
          title: title.trim(),
          one_line: oneLine.trim(),
          weather: weather.trim(),
          visited_at: visitedAt ? `${visitedAt}T00:00:00` : undefined,
          photos,
          place_id: place?.id,
        });
        onUpdated?.();
        resetAndClose();
      } catch (e) {
        Alert.alert('수정에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!place) {
      Alert.alert('장소를 선택해주세요');
      return;
    }
    setSaving(true);
    try {
      const photoUrls = assets.length > 0 ? await uploadPhotos() : undefined;
      await visitLogApi.create(place.id, {
        // 사진별 캡션 지원(2026-09-07 결정, decision-log 참고)으로 photo_urls -> photos로 계약
        // 변경 — 이 화면엔 아직 캡션 입력 UI가 없어서(Figma 593:12613에도 없음) caption 없이
        // url만 보냄
        photos: photoUrls?.map((url) => ({ url })),
        title: title.trim() || undefined,
        one_line: oneLine.trim() || undefined,
        weather: weather.trim() || undefined,
        visited_at: visitedAt ? `${visitedAt}T00:00:00` : undefined,
      });
      onCreated();
      resetAndClose();
    } catch (e) {
      Alert.alert('기록 작성에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!editLog) return;
    Alert.alert('기록을 삭제할까요?', undefined, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: handleDelete },
    ]);
  }

  async function handleDelete() {
    if (!editLog) return;
    setDeleting(true);
    try {
      await visitLogApi.remove(editLog.id);
      onDeleted?.();
      resetAndClose();
    } catch (e) {
      Alert.alert('삭제에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
      setDeleting(false);
    }
  }

  if (showPlacePicker) {
    return (
      <Modal visible transparent={false} animationType="slide" onRequestClose={() => setShowPlacePicker(false)}>
        <PlaceListScreen
          onExit={() => setShowPlacePicker(false)}
          onSelectPlace={(selected) => {
            setPlace(selected);
            setShowPlacePicker(false);
          }}
        />
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={resetAndClose}>
      <Pressable style={styles.backdrop} onPress={resetAndClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <ScrollView contentContainerStyle={styles.cardContent} keyboardShouldPersistTaps="handled">
            <View style={styles.titleRow}>
              <TextInput
                style={styles.titleInput}
                value={title}
                onChangeText={setTitle}
                placeholder="제목을 입력하세요"
                placeholderTextColor={colors.black}
                maxLength={TITLE_MAX}
              />
              <PencilIcon size={16} />
            </View>

            {/* 여러 장 지원(2026-09-06 결정, decision-log 참고) — 기존 사진(existingPhotos, 수정
                모드에서만 값 있음)과 새로 고른 사진(assets)을 한 줄에 이어서 보여줌. 사진이 하나도
                없으면 기존과 동일한 점선 박스 하나, 있으면 가로 스크롤 썸네일 목록 + 남은 자리가
                있을 때만 추가 타일. 둘 다 X 배지로 제거 가능(2026-09-12, 수정 모드 사진 편집 지원) */}
            {existingPhotos.length === 0 && assets.length === 0 ? (
              <TouchableOpacity style={styles.photoBox} onPress={pickImage} activeOpacity={0.8}>
                <PlusIcon />
              </TouchableOpacity>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.photoRow}
                contentContainerStyle={styles.photoRowContent}
              >
                {existingPhotos.map((p, index) => (
                  <View key={`existing-${p.url}`} style={styles.photoThumbBox}>
                    <Image source={{ uri: p.url }} style={styles.photoPreview} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.photoRemoveBadge}
                      onPress={() => removeExistingPhoto(index)}
                      hitSlop={6}
                    >
                      <Text style={styles.photoRemoveIcon}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {assets.map((a, index) => (
                  <View key={a.assetId ?? a.uri} style={styles.photoThumbBox}>
                    <Image source={{ uri: a.uri }} style={styles.photoPreview} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.photoRemoveBadge}
                      onPress={() => removeAsset(index)}
                      hitSlop={6}
                    >
                      <Text style={styles.photoRemoveIcon}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {existingPhotos.length + assets.length < MAX_PHOTOS && (
                  <TouchableOpacity style={styles.photoAddTile} onPress={pickImage} activeOpacity={0.8}>
                    <PlusIcon />
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}

            <View style={styles.textarea}>
              <TextInput
                style={styles.textareaInput}
                value={oneLine}
                onChangeText={setOneLine}
                placeholder="여행에서 즐거웠던 추억을 기록하세요."
                placeholderTextColor={colors.gray500}
                maxLength={ONE_LINE_MAX}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.counter}>
                {oneLine.length}/{ONE_LINE_MAX}
              </Text>
            </View>

            <TouchableOpacity style={styles.fieldBox} onPress={() => setShowCalendar(true)} activeOpacity={0.8}>
              <Text style={visitedAt ? styles.fieldValue : styles.fieldPlaceholder}>
                {visitedAt ? formatDateLabel(visitedAt) : '날짜를 입력해주세요.'}
              </Text>
            </TouchableOpacity>

            {/* 수정 모드에서도 탭하면 PlaceListScreen이 열려서 장소를 바꿀 수 있음(2026-09-12,
                사용자 요청으로 읽기 전용에서 편집 가능으로 변경) */}
            <TouchableOpacity style={styles.fieldBox} onPress={() => setShowPlacePicker(true)} activeOpacity={0.8}>
              <Text style={place ? styles.fieldValue : styles.fieldPlaceholder}>
                {place ? place.name : '장소를 입력해주세요'}
              </Text>
            </TouchableOpacity>

            <View style={styles.fieldBox}>
              <TextInput
                style={styles.fieldInput}
                value={weather}
                onChangeText={setWeather}
                placeholder="날씨를 입력해주세요"
                placeholderTextColor={colors.gray500}
                maxLength={WEATHER_MAX}
              />
            </View>

            {editLog && (
              <TouchableOpacity onPress={confirmDelete} disabled={saving || deleting} style={styles.deleteLinkRow}>
                <Text style={styles.deleteLinkText}>{deleting ? '삭제 중...' : '이 기록 삭제'}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={resetAndClose} disabled={saving || deleting}>
              <Text style={styles.cancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm} disabled={saving || deleting}>
              <Text style={styles.confirmText}>
                {saving ? '저장 중...' : editLog ? '수정' : '확인'}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>

      <CalendarPicker
        visible={showCalendar}
        value={visitedAt || toDateOnly(new Date().toISOString())}
        onClose={() => setShowCalendar(false)}
        onConfirm={(date) => {
          setVisitedAt(date);
          setShowCalendar(false);
        }}
      />
    </Modal>
  );
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function formatDateLabel(dateKey: string) {
  const d = new Date(dateKey + 'T00:00:00');
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${WEEKDAY_LABELS[d.getDay()]})`;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17,17,17,0.5)', alignItems: 'center', justifyContent: 'center' },
  card: {
    width: '80%',
    maxHeight: '85%',
    backgroundColor: colors.white,
    borderRadius: 8,
    overflow: 'hidden',
  },
  cardContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  titleInput: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 20,
    letterSpacing: -0.5,
    color: colors.black,
    padding: 0,
  },
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
  // 여러 장 지원(2026-09-06 결정, decision-log 참고) — photoBox와 같은 높이(144)를 유지해서
  // 사진 있음/없음 전환 시 카드 전체 높이가 흔들리지 않게 함
  photoRow: { height: 144, marginBottom: 12 },
  photoRowContent: { gap: 8 },
  photoThumbBox: {
    width: 144,
    height: 144,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
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
  textarea: {
    height: 144,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
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
  fieldPlaceholder: { fontFamily: fonts.regular, fontSize: 12, letterSpacing: -0.3, color: colors.gray500 },
  fieldValue: { fontFamily: fonts.regular, fontSize: 12, letterSpacing: -0.3, color: colors.black },
  // 수정 모드 전용 — Figma 시안(593:12613)엔 삭제 버튼이 없어서(생성 전용 프레임이라) 새로 디자인
  // 안 하고 기존 취소/삭제류 톤(colors.danger)만 가져다 쓴 임시 텍스트 링크(2026-09-12)
  deleteLinkRow: { alignItems: 'center', marginTop: 4 },
  deleteLinkText: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: -0.3, color: colors.danger },
  buttonRow: { flexDirection: 'row', height: 44, borderTopWidth: 1, borderTopColor: colors.border },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  cancelText: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: -0.3, color: colors.gray500 },
  confirmButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  confirmText: { fontFamily: fonts.semiBold, fontSize: 12, letterSpacing: -0.3, color: colors.accentBlue },
});
