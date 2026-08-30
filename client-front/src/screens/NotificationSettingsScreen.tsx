import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, StyleSheet, Switch, Text, View } from 'react-native';
import { NotificationSetting, userApi } from '../api/user';

interface Props {
  onExit: () => void;
}

export function NotificationSettingsScreen({ onExit }: Props) {
  const [settings, setSettings] = useState<NotificationSetting | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    userApi
      .getNotificationSetting()
      .then(setSettings)
      .catch((e) => Alert.alert('설정을 불러오지 못했어요', e instanceof Error ? e.message : '알 수 없는 오류'));
  }, []);

  async function toggle(key: keyof NotificationSetting) {
    if (!settings) return;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setSaving(true);
    try {
      await userApi.updateNotificationSetting(next);
    } catch (e) {
      setSettings(settings); // 실패 시 롤백
      Alert.alert('설정 저장에 실패했어요', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>알림 설정</Text>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>푸시 알림 전체</Text>
        <Switch value={settings.push_enabled} onValueChange={() => toggle('push_enabled')} disabled={saving} />
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>행사/축제 알림</Text>
        <Switch
          value={settings.event_alert}
          onValueChange={() => toggle('event_alert')}
          disabled={saving || !settings.push_enabled}
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>여행 코스 리마인더</Text>
        <Switch
          value={settings.course_reminder}
          onValueChange={() => toggle('course_reminder')}
          disabled={saving || !settings.push_enabled}
        />
      </View>
      <Text style={styles.hint}>
        실제 푸시 발송은 아직 서버에서도 구현되지 않았어요 — 설정값 저장만 됩니다.
      </Text>

      <View style={styles.actions}>
        <Button title="닫기" onPress={onExit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  rowLabel: { fontSize: 15 },
  hint: { fontSize: 12, color: '#999', marginTop: 12 },
  actions: { marginTop: 32 },
});
