import { Dimensions, StyleSheet, View } from 'react-native';
import { AndongGlobe } from '../../components/AndongGlobe';

const GLOBE_SIZE = Dimensions.get('window').width;

interface Props {
  onOpenLogs: () => void;
}

// Figma 노드 506:11115("메인 페이지-나의 일지") — 우선 상단 안동 지구본(장식, 드래그로 회전)만
// 띄운 상태 (2026-09-04 결정, decision-log 참고). 기존에 있던 방문 기록 핀 지도(SSOT "개인 로그"
// 기능)와 요약 카드는 일단 빼둠 — 화면이 유일하게 제공하던 실제 지도 기능이라 완전히 없앤 게 아니라
// "잠시 뺀 것"으로 취급, 지구본 레이아웃/인터랙션 확정되면 다시 올릴 자리 필요. onOpenLogs prop은
// 그 복귀 시점에 다시 쓸 예정이라 시그니처만 유지(지금은 미사용)
export function JournalTab(_props: Props) {
  return (
    <View style={styles.container}>
      <AndongGlobe size={GLOBE_SIZE} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
