import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { VisitLogMapItem, visitLogApi } from '../../api/visitLog';
import { AndongGlobe } from '../../components/AndongGlobe';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/fonts';

const ANDONG_REGION = { latitude: 36.5684, longitude: 128.7294, latitudeDelta: 0.08, longitudeDelta: 0.08 };
const GLOBE_SIZE = Dimensions.get('window').width;

interface Props {
  onOpenLogs: () => void;
}

// Figma 노드 506:11115("메인 페이지-나의 일지") — 상단 안동 지구본(장식, 드래그로 회전) + 내 방문
// 기록 핀 지도 + 요약 카드. 지구본은 디자인 그대로 반영한 순수 장식 요소라 실제 위치 데이터가 없고,
// 방문 기록을 지도 핀으로 보여주는 진짜 기능(SSOT "개인 로그" 참고)은 별개로 그 아래에 그대로 유지함
// — 지구본으로 통째로 교체하면 이 화면이 유일하게 제공하던 핀 지도 기능이 사라지기 때문
// (2026-09-04 결정, decision-log 참고)
export function JournalTab({ onOpenLogs }: Props) {
  const [logs, setLogs] = useState<VisitLogMapItem[] | null>(null);

  useEffect(() => {
    visitLogApi
      .myLogs()
      .then((res) => setLogs(res.logs))
      .catch(() => setLogs([]));
  }, []);

  const pins = (logs ?? []).filter((l) => l.lat != null && l.lng != null);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AndongGlobe size={GLOBE_SIZE} />

      <View style={styles.mapSection}>
        <MapView provider={PROVIDER_GOOGLE} style={styles.map} initialRegion={ANDONG_REGION}>
          {pins.map((log) => (
            <Marker
              key={log.id}
              coordinate={{ latitude: log.lat as number, longitude: log.lng as number }}
              title={log.place_name}
              description={log.one_line ?? undefined}
            />
          ))}
        </MapView>
        {logs === null && (
          <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
            <ActivityIndicator color={colors.black} />
          </View>
        )}
      </View>

      {logs !== null && (
        <TouchableOpacity style={styles.summaryCard} onPress={onOpenLogs}>
          <Text style={styles.summaryTitle}>
            {pins.length > 0 ? `방문 기록 ${logs.length}개` : '아직 방문 기록이 없어요'}
          </Text>
          <Text style={styles.summaryLink}>전체 보기 →</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 120 },
  mapSection: { height: 260, marginTop: 4 },
  map: { flex: 1 },
  loadingOverlay: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  summaryCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  summaryTitle: { fontFamily: fonts.semiBold, fontSize: 15, letterSpacing: -0.4, color: colors.black },
  summaryLink: { fontFamily: fonts.medium, fontSize: 13, letterSpacing: -0.3, color: colors.gray500 },
});
