import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

interface Props {
  onHome: () => void;
  onCreateManual: () => void; // "직접 일정 만들기"
  onCreateAI: () => void; // "AI 일정 추천받기"
  onProfile: () => void;
}

// Figma "메인 페이지-*" 화면들과 485:10903("코스 저장")/488:11855("관광지 저장" = 스크랩북)에
// 동일하게 배치된 하단 플로팅 네비게이션 바. 여러 화면에서 재사용되길래 공용 컴포넌트로 분리함.
//
// 2026-09-06 재검토(사용자 지적 + Figma "일정 짜기 버튼 클릭"(601:15297) 노드 직접 확인,
// decision-log 참고): milestone.md에 "실제 의도 불명확"으로 남아있던 세 버튼 역할이 실제로는
// - 좌측(홈): 나의 일지 탭으로 이동
// - 중앙(달력, 떠 있는 원형 버튼): "일정 생성" 바텀시트를 띄움(직접 일정 만들기 / AI 일정
//   추천받기 두 옵션 — 601:15506 "일정 생성" 프레임 실측 그대로)
// - 우측(사람): 마이페이지로 이동(지금까지는 헤더 우상단 아이콘에만 연결돼 있었음)
// 으로 명확했음 — 좌측/중앙 둘 다 onHome에 연결해뒀던 것과 우측이 공유하기(onShare)였던 걸 정정.
// 중앙 버튼 그라디언트도 시안 실측 결과 노랑/주황이 아니라 파랑(#005eff→#0049c7)이었음
export function FloatingNav({ onHome, onCreateManual, onCreateAI, onProfile }: Props) {
  const insets = useSafeAreaInsets();
  const [scheduleSheetVisible, setScheduleSheetVisible] = useState(false);

  function pick(action: () => void) {
    setScheduleSheetVisible(false);
    action();
  }

  return (
    <>
      <View style={[styles.floatingNav, { bottom: Math.max(20, insets.bottom + 12) }]}>
        <TouchableOpacity style={styles.sideButton} onPress={onHome} hitSlop={6}>
          <Text style={styles.emojiIcon}>🏠</Text>
        </TouchableOpacity>
        <View style={styles.centerSpacer} />
        <TouchableOpacity style={styles.sideButton} onPress={onProfile} hitSlop={6}>
          <Text style={styles.emojiIcon}>👤</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setScheduleSheetVisible(true)} hitSlop={6} style={styles.centerButton}>
          <LinearGradient
            colors={['#005eff', '#0049c7']}
            style={styles.centerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.emojiIcon}>📅</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Figma 601:15506 "일정 생성" 실측: 흰 바텀시트(둥근 위 모서리 없이 화면 하단에 딱 붙음,
          반투명 검정 배경 위) + 작은 회색 라벨 + 항목 2개(구분선/아이콘 없이 텍스트만) */}
      <Modal
        visible={scheduleSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setScheduleSheetVisible(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setScheduleSheetVisible(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom + 12) }]} onPress={() => {}}>
            <Text style={styles.sheetLabel}>일정 생성</Text>
            <TouchableOpacity style={styles.sheetItem} onPress={() => pick(onCreateManual)}>
              <Text style={styles.sheetItemText}>직접 일정 만들기</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetItem} onPress={() => pick(onCreateAI)}>
              <Text style={styles.sheetItemText}>AI 일정 추천받기</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingNav: {
    position: 'absolute',
    alignSelf: 'center',
    width: 209,
    height: 52,
    borderRadius: 100,
    backgroundColor: 'rgba(17,17,17,0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  sideButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  centerSpacer: { width: 52 },
  centerButton: {
    position: 'absolute',
    top: -14,
    left: '50%',
    marginLeft: -26,
    width: 52,
    height: 52,
  },
  centerGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiIcon: { fontSize: 18 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(17,17,17,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, paddingHorizontal: 28, paddingTop: 28 },
  sheetLabel: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: -0.3, color: colors.gray500, marginBottom: 28 },
  sheetItem: { paddingVertical: 14 },
  sheetItemText: { fontFamily: fonts.medium, fontSize: 16, letterSpacing: -0.4, color: colors.black },
});
