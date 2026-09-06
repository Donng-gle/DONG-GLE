import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Path, Rect } from 'react-native-svg';
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
// 아이콘도 이모지(🏠📅👤) 대신 Figma 실제 아이콘 그대로 재현(2026-09-06, 사용자가 "거의 말고
// 똑같이" 요청). View 테두리+회전 조합으로 근사했던 1차 시도는 좌표를 눈대중으로 잡아서
// 미묘하게 어긋났음 — scan_nodes_by_types로 아이콘 내부 벡터 자식들의 실제 bbox 좌표(28x28
// 기준)를 직접 읽어서 react-native-svg(RadarChart.tsx에서 이미 쓰던 라이브러리, 추가 설치 없음)
// viewBox="0 0 28 28"에 그 좌표 그대로 옮김 — 대략적 트릭 대신 실측 좌표 기반 재현
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

// Figma "홈" 아이콘(I601:14911;225:23653) 내부 벡터 실측(scan_nodes_by_types, 28x28 기준):
// 집 윤곽(펜타곤) bbox 4.667,4.667~23.333,23.333(정사각형) + 문(가로선) x 11.667~16.333, y 16.333.
// 지붕 어깨 높이(펜타곤 중간 꺾이는 y좌표)는 벡터 내부 세부 좌표까지는 못 읽어서 정사각형
// bbox의 45% 지점으로 근사(일반적인 집 아이콘 비율) — 나머지는 전부 실측값 그대로
const HOME_ICON_TOP = 4.667;
const HOME_ICON_BOTTOM = 23.333;
const HOME_ICON_LEFT = 4.667;
const HOME_ICON_RIGHT = 23.333;
const HOME_ICON_SHOULDER_Y = HOME_ICON_TOP + (HOME_ICON_BOTTOM - HOME_ICON_TOP) * 0.45;
function HomeIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 28 28" fill="none">
      <Path
        d={`M14 ${HOME_ICON_TOP} L${HOME_ICON_RIGHT} ${HOME_ICON_SHOULDER_Y} L${HOME_ICON_RIGHT} ${HOME_ICON_BOTTOM} L${HOME_ICON_LEFT} ${HOME_ICON_BOTTOM} L${HOME_ICON_LEFT} ${HOME_ICON_SHOULDER_Y} Z`}
        stroke={colors.white}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Line x1={11.667} y1={16.333} x2={16.333} y2={16.333} stroke={colors.white} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

// Figma "달력" 아이콘(I601:14915;225:23722) 내부 벡터 실측 — 전부 실측값 그대로:
// 몸체 x4.667~23.333, y8.167~23.333 / 헤더 구분선 y=14(8.167+5.833) / 고리 2개(x=8.167,19.833,
// y 4.667~8.167)
function CalendarIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 28 28" fill="none">
      <Rect x={4.667} y={8.167} width={18.667} height={15.167} rx={3} stroke={colors.white} strokeWidth={1.8} />
      <Line x1={4.667} y1={14} x2={23.333} y2={14} stroke={colors.white} strokeWidth={1.8} />
      <Line x1={8.167} y1={4.667} x2={8.167} y2={8.167} stroke={colors.white} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={19.833} y1={4.667} x2={19.833} y2={8.167} stroke={colors.white} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

// Figma "마이페이지"(사람) 아이콘(I601:14912;225:23654) 내부 요소 실측: 머리 원(Ellipse 1,
// 중심 14,14.17 반지름3.5) + 어깨(Rectangle 8, x4.667~23.333 폭18.667, y22.33~29.33 높이7,
// 위쪽만 둥근 아치 — 반지름이 높이(7)와 같아서 RN의 borderTopLeftRadius로 그대로 표현 가능,
// SVG 없이 다른 아이콘들과 동일한 View 방식이 오히려 더 정확함). 28 기준 좌표를 20 아이콘
// 박스에 맞게 20/28 배율로 환산
function PersonIcon() {
  return (
    <View style={personIconStyles.container}>
      <View style={personIconStyles.head} />
      <View style={personIconStyles.shoulders} />
    </View>
  );
}

const personIconStyles = StyleSheet.create({
  container: { width: 20, height: 21, alignItems: 'center' },
  head: {
    position: 'absolute',
    top: 7.6, // (14.17-3.5)*20/28
    width: 5, // 3.5*2*20/28
    height: 5,
    borderRadius: 2.5,
    borderWidth: 1.7,
    borderColor: colors.white,
  },
  shoulders: {
    position: 'absolute',
    top: 16, // 22.33*20/28
    width: 13.3, // 18.667*20/28
    height: 5, // 7*20/28
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderWidth: 1.7,
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
