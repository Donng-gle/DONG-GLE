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
// 중앙 버튼 그라디언트도 시안 실측 결과 노랑/주황이 아니라 파랑(#005eff→#0049c7)이었음.
//
// 아이콘도 이모지(🏠📅👤) 대신 Figma 실제 아이콘(export_node_as_image로 직접 확인:
// 홈=지붕+문 모양 아웃라인, 달력=상단 고리 2개+구분선 있는 아웃라인, 사람=머리+어깨 아웃라인,
// 전부 흰색 선 스타일)에 맞춰 이 파일 안에서 View 조합으로 근사 재현함(2026-09-06, 사용자 요청)
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
          <HomeIcon />
        </TouchableOpacity>
        <View style={styles.centerSpacer} />
        <TouchableOpacity style={styles.sideButton} onPress={onProfile} hitSlop={6}>
          <PersonIcon />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setScheduleSheetVisible(true)} hitSlop={6} style={styles.centerButton}>
          <LinearGradient
            colors={['#005eff', '#0049c7']}
            style={styles.centerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <CalendarIcon />
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

// 집 모양(지붕 + 벽 사각형 + 문 자리 가로선), 전부 흰색 선(icons.tsx의 다른 아이콘들과 동일하게
// 별도 에셋 없이 View만 조합). 지붕은 막대 2개를 따로 회전시켰다가 꼭짓점이 안 맞아 떨어져
// 보였음(2026-09-06) — ChevronRightIcon과 동일하게 정사각형 하나에 위/왼쪽 테두리만 주고
// 45도 회전시키는 방식으로 교체(그 모서리가 그대로 지붕 꼭짓점이 되어 좌우 대칭 지붕이 됨)
function HomeIcon() {
  return (
    <View style={homeIconStyles.container}>
      <View style={homeIconStyles.roof} />
      <View style={homeIconStyles.body} />
      <View style={homeIconStyles.door} />
    </View>
  );
}

const homeIconStyles = StyleSheet.create({
  container: { width: 20, height: 18, alignItems: 'center' },
  roof: {
    position: 'absolute',
    top: 1,
    width: 11,
    height: 11,
    borderTopWidth: 1.6,
    borderLeftWidth: 1.6,
    borderColor: colors.white,
    transform: [{ rotate: '45deg' }],
  },
  body: {
    position: 'absolute',
    bottom: 0,
    width: 14,
    height: 9,
    borderWidth: 1.6,
    borderTopWidth: 0,
    borderColor: colors.white,
  },
  door: { position: 'absolute', bottom: 3, width: 6, height: 1.6, borderRadius: 1, backgroundColor: colors.white },
});

// 달력 모양(몸체 아웃라인 + 상단 고리 2개 + 헤더 구분선), 흰색 선
function CalendarIcon() {
  return (
    <View style={calendarIconStyles.container}>
      <View style={calendarIconStyles.ringLeft} />
      <View style={calendarIconStyles.ringRight} />
      <View style={calendarIconStyles.body}>
        <View style={calendarIconStyles.divider} />
      </View>
    </View>
  );
}

const calendarIconStyles = StyleSheet.create({
  container: { width: 20, height: 20, alignItems: 'center', justifyContent: 'flex-end' },
  body: { width: 16, height: 14, borderRadius: 3, borderWidth: 1.6, borderColor: colors.white },
  divider: { position: 'absolute', top: 4, left: 0, right: 0, height: 1.6, backgroundColor: colors.white },
  ringLeft: { position: 'absolute', top: 0, left: 5, width: 1.6, height: 5, borderRadius: 1, backgroundColor: colors.white },
  ringRight: { position: 'absolute', top: 0, right: 5, width: 1.6, height: 5, borderRadius: 1, backgroundColor: colors.white },
});

// 사람 실루엣(머리 원 + 어깨 아치), 흰색 선 — components/icons.tsx의 ProfileIcon과 같은 형태를
// 이 화면(어두운 알약 배경) 전용으로 흰색으로 다시 그림
function PersonIcon() {
  return (
    <View style={personIconStyles.container}>
      <View style={personIconStyles.head} />
      <View style={personIconStyles.shoulders} />
    </View>
  );
}

const personIconStyles = StyleSheet.create({
  container: { width: 20, height: 20, alignItems: 'center' },
  head: { width: 7, height: 7, borderRadius: 3.5, borderWidth: 1.4, borderColor: colors.white, marginBottom: 2 },
  shoulders: {
    width: 18,
    height: 8,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderWidth: 1.4,
    borderColor: colors.white,
    borderBottomWidth: 0,
  },
});

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
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(17,17,17,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, paddingHorizontal: 28, paddingTop: 28 },
  sheetLabel: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: -0.3, color: colors.gray500, marginBottom: 28 },
  sheetItem: { paddingVertical: 14 },
  sheetItemText: { fontFamily: fonts.medium, fontSize: 16, letterSpacing: -0.4, color: colors.black },
});
