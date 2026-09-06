import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { StatusBar } from 'expo-status-bar';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CourseManualRequest, courseApi } from '../api/course';
import { PlaceListItem } from '../api/place';
import { SwipeTransport } from '../api/swipe';
import { CalendarPicker } from '../components/CalendarPicker';
import { FloatingNav } from '../components/FloatingNav';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { PlaceListScreen } from './PlaceListScreen';

interface Props {
  onSaved: () => void;
  onExit: () => void;
  onCreateManual: () => void;
  onCreateAI: () => void;
  onProfile: () => void;
}

type Step = 'form' | 'picking';

const TODAY = new Date().toISOString().slice(0, 10);
const ANDONG_REGION = { latitude: 36.5684, longitude: 128.7294, latitudeDelta: 0.15, longitudeDelta: 0.15 };
// 저장 전(초안) 화면이라 서버 경로 API를 아직 호출할 게 없어서 좌표 직선거리로만 대략 추정 —
// 저장 후 실제 코스 상세(CourseResultScreen 등)는 서버가 계산한 실제 경로 값을 씀
const WALK_SPEED_KMH = 4.5;

const TRANSPORT_OPTIONS: { value: SwipeTransport; label: string }[] = [
  { value: 'walk', label: '도보' },
  { value: 'car', label: '자동차' },
  { value: 'public', label: '대중교통' },
];

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// start~end 사이 모든 날짜를 하루 단위로 나열(end 없으면 하루짜리). 날짜 탭은 UI 표시 전용이고
// 장소 목록은 날짜별로 나뉘지 않음(2026-09-06 사용자 확인, course_place에 날짜 필드 추가하는
// 백엔드 변경은 이번 범위 밖 — 오늘 이미 결정한 "하나의 순서 리스트" 방침 유지)
function buildDateTabs(start: string, end: string | null) {
  const startDate = new Date(start + 'T00:00:00');
  const endDate = end ? new Date(end + 'T00:00:00') : startDate;
  const tabs: { dateKey: string; day: number; weekday: string }[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    tabs.push({ dateKey: toDateKey(cursor), day: cursor.getDate(), weekday: WEEKDAY_LABELS[cursor.getDay()] });
    cursor.setDate(cursor.getDate() + 1);
  }
  return tabs;
}

function formatShortDateLabel(dateKey: string) {
  const [, m, d] = dateKey.split('-').map(Number);
  const weekday = WEEKDAY_LABELS[new Date(dateKey + 'T00:00:00').getDay()];
  return `${m}/${d}(${weekday})`;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

// decision-log 2026-07-17: 코스 생성 진입점 2가지(AI 코스 / 직접 코스) 중 직접 코스 쪽.
// POST /courses/manual — course_optimizer를 거치지 않고 사용자가 장소·순서를 직접 정해서 저장
//
// Figma 501:12543("...기본화면", 빈 상태)/501:12088(장소 있는 상태) 반영(2026-09-06, 사용자가
// 스크린샷 6장 첨부하며 "디자인 동일하게" 요청) — 기존 단순 폼(제목 입력창+날짜 필드+이동수단
// 라디오+평평한 장소 리스트)을 날짜 탭+지도+장소 리스트가 있는 "여행" 화면으로 전면 교체.
// 시안엔 없지만 실제로 필요한 것들을 사용자 확인 하에 이렇게 채워 넣음:
// - 제목 수정·이동 수단 선택: 시안엔 해당 컨트롤이 안 보여서 연필 아이콘 뒤 편집 모달로 뺌
// - 장소 카드 순서 변경(▲▼)·삭제(✕): 시안엔 없지만 기존 CourseBuilderPlaceList에 있던 기능이라
//   빼면 퇴보라 작게 유지
// - 저장 버튼: 시안엔 화면 하단이 플로팅 네비에 가려 안 보이는데, 스크롤 맨 아래에 배치
// - 하트/북마크 헤더 아이콘: 시안엔 있지만 대응 기능(찜/공유 등)이 없어서 현재는 장식만(터치 불가)
export function CourseManualBuilderScreen({ onSaved, onExit, onCreateManual, onCreateAI, onProfile }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('form');
  const [title, setTitle] = useState('안동 여행');
  const [travelDate, setTravelDate] = useState(TODAY);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [transport, setTransport] = useState<SwipeTransport>('walk');
  const [showCalendar, setShowCalendar] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [places, setPlaces] = useState<PlaceListItem[]>([]);
  const [selectedDateTab, setSelectedDateTab] = useState(travelDate);
  const [saving, setSaving] = useState(false);

  const dateTabs = useMemo(() => buildDateTabs(travelDate, endDate), [travelDate, endDate]);

  function addPlace(place: PlaceListItem) {
    if (places.some((p) => p.id === place.id)) {
      Alert.alert('이미 추가된 장소예요');
      return;
    }
    setPlaces([...places, place]);
    setStep('form');
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...places];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setPlaces(next);
  }

  function moveDown(index: number) {
    if (index === places.length - 1) return;
    const next = [...places];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setPlaces(next);
  }

  function removePlace(index: number) {
    setPlaces(places.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (places.length === 0) {
      Alert.alert('장소를 1곳 이상 추가해주세요');
      return;
    }
    setSaving(true);
    try {
      const request: CourseManualRequest = {
        title: title.trim() || '안동 여행',
        travel_date: travelDate,
        end_date: endDate && endDate !== travelDate ? endDate : null,
        transport,
        places: places.map((place, index) => ({ place_id: place.id, visit_order: index + 1 })),
      };
      await courseApi.saveManual(request);
      Alert.alert('코스가 저장됐어요', undefined, [{ text: '확인', onPress: onSaved }]);
    } catch (e) {
      Alert.alert('저장에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setSaving(false);
    }
  }

  if (step === 'picking') {
    return <PlaceListScreen onExit={() => setStep('form')} onSelectPlace={addPlace} />;
  }

  const pinnedPlaces = places
    .map((p, i) => ({ ...p, visitOrder: i + 1 }))
    .filter((p): p is PlaceListItem & { visitOrder: number } => p.lat != null && p.lng != null);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.headerTop, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={onExit} hitSlop={8} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerIcons}>
            <Text style={styles.headerIcon}>♡</Text>
            <TouchableOpacity onPress={() => setStep('picking')} hitSlop={6}>
              <Text style={styles.headerIcon}>🔍</Text>
            </TouchableOpacity>
            <Text style={styles.headerIcon}>🔖</Text>
          </View>
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.titleText} numberOfLines={1}>
            {title}
          </Text>
          <TouchableOpacity onPress={() => setShowEditModal(true)} hitSlop={8}>
            <Text style={styles.pencilIcon}>✎</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateTabRow}>
          {dateTabs.map((tab) => {
            const selected = tab.dateKey === selectedDateTab;
            return (
              <TouchableOpacity
                key={tab.dateKey}
                style={[styles.dateTab, selected && styles.dateTabSelected]}
                onPress={() => setSelectedDateTab(tab.dateKey)}
              >
                <Text style={[styles.dateTabWeekday, selected && styles.dateTabTextSelected]}>{tab.weekday}</Text>
                <Text style={[styles.dateTabDay, selected && styles.dateTabTextSelected]}>{tab.day}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <MapView provider={PROVIDER_GOOGLE} style={styles.map} initialRegion={ANDONG_REGION}>
          {pinnedPlaces.length > 1 && (
            <Polyline
              coordinates={pinnedPlaces.map((p) => ({ latitude: p.lat as number, longitude: p.lng as number }))}
              strokeColor={colors.accentBlue}
              strokeWidth={2}
              lineDashPattern={[6, 6]}
            />
          )}
          {pinnedPlaces.map((p) => (
            <Marker key={p.id} coordinate={{ latitude: p.lat as number, longitude: p.lng as number }}>
              <View style={styles.pinWrap}>
                <View style={styles.pinCircle}>
                  <Text style={styles.pinText}>{p.visitOrder}</Text>
                </View>
                <View style={styles.pinShadow} />
              </View>
            </Marker>
          ))}
        </MapView>

        <View style={styles.listSection}>
          <Text style={styles.dayHeader}>{formatShortDateLabel(selectedDateTab)}</Text>

          {places.map((place, index) => {
            const prev = index > 0 ? places[index - 1] : null;
            const distanceKm =
              prev && prev.lat != null && prev.lng != null && place.lat != null && place.lng != null
                ? haversineKm({ lat: prev.lat, lng: prev.lng }, { lat: place.lat, lng: place.lng })
                : null;
            return (
              <View key={place.id} style={styles.placeRow}>
                <View style={styles.placeRowLeft}>
                  <View style={styles.placeMarkerDot} />
                  {index < places.length - 1 && <View style={styles.placeConnector} />}
                </View>
                <View style={styles.placeRowRight}>
                  <View style={styles.placeCard}>
                    {place.main_image_url ? (
                      <Image source={{ uri: place.main_image_url }} style={styles.placeThumbnail} resizeMode="cover" />
                    ) : (
                      <View style={[styles.placeThumbnail, styles.placeThumbnailPlaceholder]} />
                    )}
                    <View style={styles.placeInfo}>
                      <Text style={styles.placeName} numberOfLines={1}>
                        {place.name}
                      </Text>
                      <Text style={styles.placeCategory}>{place.category}</Text>
                    </View>
                    <View style={styles.placeControls}>
                      <TouchableOpacity onPress={() => moveUp(index)} disabled={index === 0} hitSlop={6}>
                        <Text style={[styles.controlIcon, index === 0 && styles.controlIconDisabled]}>▲</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => moveDown(index)} disabled={index === places.length - 1} hitSlop={6}>
                        <Text style={[styles.controlIcon, index === places.length - 1 && styles.controlIconDisabled]}>▼</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removePlace(index)} hitSlop={6}>
                        <Text style={styles.controlIcon}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {distanceKm != null && (
                    <Text style={styles.placeMeta}>
                      {distanceKm.toFixed(1)} KM · 약 {Math.max(1, Math.round((distanceKm / WALK_SPEED_KMH) * 60))}분
                    </Text>
                  )}
                </View>
              </View>
            );
          })}

          <TouchableOpacity style={styles.addPlaceButton} onPress={() => setStep('picking')}>
            <Text style={styles.addPlaceButtonText}>장소 추가</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.saveSection}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>코스 저장</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <FloatingNav onHome={onExit} onCreateManual={onCreateManual} onCreateAI={onCreateAI} onProfile={onProfile} />

      {/* 시안엔 없는 컨트롤(제목 수정/날짜/이동 수단)을 연필 아이콘 뒤 편집 모달로 모아둠 */}
      <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={() => setShowEditModal(false)}>
        <Pressable style={styles.editBackdrop} onPress={() => setShowEditModal(false)}>
          <Pressable style={[styles.editSheet, { paddingBottom: Math.max(24, insets.bottom + 16) }]} onPress={() => {}}>
            <Text style={styles.editLabel}>코스 제목</Text>
            <TextInput
              style={styles.editInput}
              value={title}
              onChangeText={setTitle}
              placeholder="안동 여행"
              placeholderTextColor={colors.gray500}
            />

            <Text style={[styles.editLabel, styles.editLabelSpaced]}>여행 날짜</Text>
            <TouchableOpacity
              style={styles.editField}
              onPress={() => {
                setShowEditModal(false);
                setShowCalendar(true);
              }}
            >
              <Text style={styles.editFieldText}>
                {formatShortDateLabel(travelDate)}
                {endDate && endDate !== travelDate ? ` ~ ${formatShortDateLabel(endDate)}` : ''}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.editLabel, styles.editLabelSpaced]}>이동 수단</Text>
            <View style={styles.transportRow}>
              {TRANSPORT_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.transportOption, transport === option.value && styles.transportOptionSelected]}
                  onPress={() => setTransport(option.value)}
                >
                  <Text
                    style={[styles.transportOptionText, transport === option.value && styles.transportOptionTextSelected]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.editDoneButton} onPress={() => setShowEditModal(false)}>
              <Text style={styles.editDoneButtonText}>완료</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <CalendarPicker
        visible={showCalendar}
        mode="range"
        value={travelDate}
        rangeEnd={endDate ?? undefined}
        minDate={TODAY}
        onClose={() => setShowCalendar(false)}
        onConfirm={(date) => {
          setTravelDate(date);
          setEndDate(null);
          setSelectedDateTab(date);
          setShowCalendar(false);
        }}
        onConfirmRange={(start, end) => {
          setTravelDate(start);
          setEndDate(end !== start ? end : null);
          setSelectedDateTab(start);
          setShowCalendar(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  scrollContent: { paddingBottom: 140 }, // 플로팅 네비에 안 가리게 여유
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  backButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 20, color: colors.black },
  headerIcons: { flexDirection: 'row', gap: 16 },
  headerIcon: { fontSize: 18, color: colors.black },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 12 },
  titleText: { fontFamily: fonts.semiBold, fontSize: 24, letterSpacing: -0.6, color: colors.black, flexShrink: 1 },
  pencilIcon: { fontSize: 15, color: colors.gray500 },
  dateTabRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16 },
  dateTab: { width: 36, height: 56, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 4 },
  dateTabSelected: { backgroundColor: colors.accentBlue },
  dateTabWeekday: { fontFamily: fonts.regular, fontSize: 16, letterSpacing: -0.4, color: colors.gray700 },
  dateTabDay: { fontFamily: fonts.regular, fontSize: 16, letterSpacing: -0.4, color: colors.gray700 },
  dateTabTextSelected: { color: colors.white },
  map: { width: '100%', height: 166 },
  pinWrap: { alignItems: 'center' },
  pinCircle: { width: 25, height: 25, borderRadius: 13, backgroundColor: colors.pinBackground, alignItems: 'center', justifyContent: 'center' },
  pinText: { fontFamily: fonts.bold, fontSize: 13, color: colors.accentBlue },
  pinShadow: { width: 20, height: 4, borderRadius: 2, backgroundColor: colors.accentBlue, opacity: 0.35, marginTop: 3 },
  listSection: { paddingHorizontal: 20, paddingTop: 16 },
  dayHeader: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.black, marginBottom: 12 },
  placeRow: { flexDirection: 'row' },
  placeRowLeft: { width: 24, alignItems: 'center' },
  placeMarkerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentBlue, marginTop: 20 },
  placeConnector: { flex: 1, width: 1, backgroundColor: colors.border, marginVertical: 4, minHeight: 30 },
  placeRowRight: { flex: 1, marginLeft: 8, paddingBottom: 16 },
  placeCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, padding: 8, gap: 12 },
  placeThumbnail: { width: 48, height: 48, borderRadius: 4 },
  placeThumbnailPlaceholder: { backgroundColor: colors.border },
  placeInfo: { flex: 1 },
  placeName: { fontFamily: fonts.medium, fontSize: 16, letterSpacing: -0.4, color: colors.black },
  placeCategory: { fontFamily: fonts.regular, fontSize: 12, letterSpacing: -0.3, color: colors.gray400, marginTop: 2 },
  placeControls: { flexDirection: 'row', gap: 10 },
  controlIcon: { fontSize: 12, color: colors.gray500 },
  controlIconDisabled: { color: colors.border },
  placeMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray500, marginLeft: 8, marginTop: 4 },
  addPlaceButton: { height: 44, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  addPlaceButtonText: { fontFamily: fonts.semiBold, fontSize: 14, letterSpacing: -0.35, color: colors.black },
  saveSection: { paddingHorizontal: 20, paddingTop: 20 },
  primaryButton: { height: 52, borderRadius: 8, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.24, color: colors.white },
  editBackdrop: { flex: 1, backgroundColor: 'rgba(17,17,17,0.5)', justifyContent: 'flex-end' },
  editSheet: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 20 },
  editLabel: { fontFamily: fonts.medium, fontSize: 14, letterSpacing: -0.35, color: colors.black, marginBottom: 8 },
  editLabelSpaced: { marginTop: 20 },
  editInput: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.black,
  },
  editField: { height: 48, borderRadius: 8, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', paddingHorizontal: 16 },
  editFieldText: { fontFamily: fonts.regular, fontSize: 15, color: colors.black },
  transportRow: { flexDirection: 'row', gap: 8 },
  transportOption: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  transportOptionSelected: { backgroundColor: colors.black, borderColor: colors.black },
  transportOptionText: { fontFamily: fonts.medium, fontSize: 14, color: colors.gray700 },
  transportOptionTextSelected: { color: colors.white },
  editDoneButton: { height: 48, borderRadius: 8, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  editDoneButtonText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
});
