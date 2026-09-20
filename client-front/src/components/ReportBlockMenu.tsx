import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { ChoiceBottomSheet } from './ChoiceBottomSheet';
import { moderationApi, ReportReason, ReportTargetType } from '../api/moderation';
import { colors } from '../theme/colors';

// 앱스토어 심사 가이드라인 1.2(User Generated Content) 대응 — 다른 사용자 콘텐츠가 보이는 카드
// (ExploreScreen/RecommendedTab의 유사 사용자 카드, PlaceDetailScreen 리뷰 카드)에 공통으로 붙이는
// "⋯" 메뉴. 신고 사유 4종은 백엔드 ReportReason enum과 1:1 매칭(2026-09-14 사용자 확정 스펙)
const REASON_LABELS: Record<ReportReason, string> = {
  inappropriate: '부적절한 콘텐츠',
  spam: '스팸',
  abuse: '욕설',
  other: '기타',
};

interface Props {
  authorUserId: number;
  targetType: ReportTargetType;
  targetId: number;
  // 차단 성공 시 부모가 목록에서 이 작성자의 콘텐츠를 즉시 걷어낼 수 있게 알림(서버 필터링은
  // 다음 새로고침부터 적용되므로, 화면 반응성을 위해 클라이언트에서도 바로 반영)
  onBlocked?: () => void;
  // 사진 오버레이 카드(PlaceDetailScreen 리뷰 그리드)처럼 어두운 배경 위에 놓일 때는 흰색이 필요해서
  iconColor?: string;
}

export function ReportBlockMenu({ authorUserId, targetType, targetId, onBlocked, iconColor }: Props) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [reasonVisible, setReasonVisible] = useState(false);

  async function submitReport(reason: ReportReason) {
    try {
      await moderationApi.report({ target_type: targetType, target_id: targetId, reason });
      Alert.alert('신고 접수됨', '신고해주셔서 감사합니다. 운영팀이 확인할게요.');
    } catch (e) {
      Alert.alert('신고 실패', e instanceof Error ? e.message : '알 수 없는 오류');
    }
  }

  function confirmBlock() {
    Alert.alert('사용자 차단', '이 사용자를 차단하면 앞으로 이 사용자의 콘텐츠가 보이지 않아요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '차단',
        style: 'destructive',
        onPress: async () => {
          try {
            await moderationApi.blockUser(authorUserId);
            onBlocked?.();
          } catch (e) {
            Alert.alert('차단 실패', e instanceof Error ? e.message : '알 수 없는 오류');
          }
        },
      },
    ]);
  }

  return (
    <>
      <TouchableOpacity style={styles.button} onPress={() => setMenuVisible(true)} hitSlop={8}>
        <Text style={[styles.icon, iconColor ? { color: iconColor } : null]}>⋯</Text>
      </TouchableOpacity>

      <ChoiceBottomSheet
        visible={menuVisible}
        label="더보기"
        onClose={() => setMenuVisible(false)}
        options={[
          { label: '신고하기', onPress: () => setReasonVisible(true) },
          { label: '차단하기', onPress: confirmBlock },
        ]}
      />

      <ChoiceBottomSheet
        visible={reasonVisible}
        label="신고 사유를 선택해주세요"
        onClose={() => setReasonVisible(false)}
        options={(Object.keys(REASON_LABELS) as ReportReason[]).map((reason) => ({
          label: REASON_LABELS[reason],
          onPress: () => submitReport(reason),
        }))}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 18, color: colors.gray500, fontWeight: '700' },
});
