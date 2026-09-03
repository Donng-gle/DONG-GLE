import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { VisitLogMapItem, visitLogApi } from '../../api/visitLog';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/fonts';

const ANDONG_REGION = { latitude: 36.5684, longitude: 128.7294, latitudeDelta: 0.08, longitudeDelta: 0.08 };

interface Props {
  onOpenLogs: () => void;
}

// Figma 노드 506:11115("메인 페이지-나의 일지") — 지도 + 방문 기록 요약 카드
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
    <View style={styles.container}>
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

      {logs === null ? (
        <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
          <ActivityIndicator color={colors.black} />
        </View>
      ) : (
        <TouchableOpacity style={styles.summaryCard} onPress={onOpenLogs}>
          <Text style={styles.summaryTitle}>
            {pins.length > 0 ? `방문 기록 ${logs.length}개` : '아직 방문 기록이 없어요'}
          </Text>
          <Text style={styles.summaryLink}>전체 보기 →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loadingOverlay: { alignItems: 'center', justifyContent: 'center' },
  summaryCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 96,
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
