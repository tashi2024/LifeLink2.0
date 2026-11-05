// src/screens/settings/NotificationSettingsScreen.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  CHANNELS,
  registerForPushNotifications,
  savePushToken,
} from '../../services/notifications/notificationService';
import { getPushReceipts, sendPushMessages, ticketProblem } from '../../services/notifications/pushSender';
import { DEFAULT_ALERT_RADIUS_KM } from '../../services/notifications/requestAlertService';
import { observeMyDonor } from '../../services/donor/donorService';
import { setAlertRadius } from '../../services/donor/alertSettingsService';
import AppButton from '../../components/AppButton';
import OptionSelector from '../../components/OptionSelector';
import { colors } from '../../utils/theme';

const STATUS_TEXT = {
  checking: 'Checking...',
  granted: 'On',
  denied: 'Off',
  blocked: 'Blocked in phone settings',
  unsupported: 'Not supported on this device',
  error: 'Problem',
};

const RADIUS_OPTIONS = ['Off', '1 km', '5 km', '10 km', '25 km'];
const toLabel = (km) => (km === 0 ? 'Off' : `${km} km`);
const toKm = (label) => (label === 'Off' ? 0 : parseInt(label, 10));

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function NotificationSettingsScreen({ navigation }) {
  const [state, setState] = useState({ status: 'checking', token: null, message: '', saved: false });
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const [donor, setDonor] = useState(undefined); // undefined = loading, null = not a donor
  const [savingRadius, setSavingRadius] = useState(false);
  const waiting = useRef(null); // the delivery-time test that is waiting for its notification

  const addLog = (line) => setLog((previous) => [...previous, line]);

  // Checks permission, gets the token and saves it
  const refresh = useCallback(async () => {
    setBusy(true);
    const result = await registerForPushNotifications();
    let saved = false;
    if (result.status === 'granted') {
      try {
        await savePushToken(result.token);
        saved = true;
      } catch (error) {
        console.log('savePushToken failed:', error.code || error.message);
      }
    }
    setState({ status: result.status, token: result.token ?? null, message: result.message ?? '', saved });
    setBusy(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Donor profile (for the alert radius)
  useEffect(() => observeMyDonor(setDonor, () => setDonor(null)), []);

  // Listens for the notification that the delivery-time test is waiting for
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      const pending = waiting.current;
      if (pending && data?.type === 'latency_test' && data.testId === pending.testId) {
        pending.resolve(Date.now() - pending.sentAt);
      }
    });
    return () => subscription.remove();
  }, []);

  const changeRadius = async (label) => {
    setSavingRadius(true);
    try {
      await setAlertRadius(toKm(label));
    } catch (error) {
      Alert.alert('Could not save', error.message);
    } finally {
      setSavingRadius(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    addLog('Sending test notification...');
    try {
      const tickets = await sendPushMessages([
        {
          to: state.token,
          title: 'LifeLink test',
          body: 'Push notifications are working.',
          data: { type: 'test' },
          channelId: CHANNELS.RESPONSES,
          sound: 'default',
          priority: 'high',
        },
      ]);
      const problem = ticketProblem(tickets[0]);
      if (problem) {
        addLog(`Rejected: ${problem}`);
        return;
      }
      addLog('Accepted by Expo. Checking delivery in 8 seconds...');
      await wait(8000);
      const receipts = await getPushReceipts([tickets[0].id]);
      const receipt = receipts[tickets[0].id];
      if (!receipt) {
        addLog('No delivery receipt yet. Check your phone anyway.');
      } else if (receipt.status === 'ok') {
        addLog('Handed to Google (FCM). The notification should appear on this phone.');
      } else {
        addLog(`Delivery failed: ${receipt.details?.error || receipt.message}`);
      }
    } catch (error) {
      addLog(`Error: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  // Sends one push to this phone and measures how long it takes to arrive (app must stay open)
  const measureOnce = async () => {
    const testId = `${Date.now()}-${Math.random()}`;
    const sentAt = Date.now();
    const arrival = new Promise((resolve) => {
      const timer = setTimeout(() => {
        waiting.current = null;
        resolve(null);
      }, 20000);
      waiting.current = {
        testId,
        sentAt,
        resolve: (ms) => {
          clearTimeout(timer);
          waiting.current = null;
          resolve(ms);
        },
      };
    });

    try {
      const tickets = await sendPushMessages([
        {
          to: state.token,
          title: 'Delivery time test',
          body: 'Measuring how fast this arrives.',
          data: { type: 'latency_test', testId },
          channelId: CHANNELS.RESPONSES,
          priority: 'high',
        },
      ]);
      const problem = ticketProblem(tickets[0]);
      if (problem) {
        waiting.current?.resolve(null);
        return { error: problem };
      }
    } catch (error) {
      waiting.current?.resolve(null);
      return { error: error.message };
    }
    return { ms: await arrival };
  };

  const runLatencyTest = async () => {
    setBusy(true);
    addLog('--- Delivery time test: 5 messages (keep this screen open) ---');
    const times = [];
    for (let i = 1; i <= 5; i += 1) {
      const result = await measureOnce();
      if (result.error) {
        addLog(`#${i}: failed (${result.error})`);
      } else if (result.ms == null) {
        addLog(`#${i}: not received within 20 s`);
      } else {
        times.push(result.ms);
        addLog(`#${i}: ${(result.ms / 1000).toFixed(1)} s`);
      }
      await wait(1500);
    }
    if (times.length > 0) {
      const average = times.reduce((a, b) => a + b, 0) / times.length;
      const slowest = Math.max(...times);
      const pass = times.length === 5 && slowest < 10000;
      addLog(
        `Received ${times.length}/5. Average ${(average / 1000).toFixed(1)} s, slowest ${(slowest / 1000).toFixed(1)} s. ` +
          `${pass ? 'PASS (under 10 s)' : 'CHECK'}`
      );
    } else {
      addLog('Nothing was received.');
    }
    setBusy(false);
  };

  const granted = state.status === 'granted';
  const tokenText = !granted ? 'Not registered' : state.saved ? 'Registered' : 'Not saved (check your connection)';
  const currentRadius =
    donor && typeof donor.alertRadiusKm === 'number' ? donor.alertRadiusKm : DEFAULT_ALERT_RADIUS_KM;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Notification status</Text>
        <Text style={styles.line}>Notifications: {STATUS_TEXT[state.status]}</Text>
        <Text style={styles.line}>Push token: {tokenText}</Text>
        {state.message ? <Text style={styles.message}>{state.message}</Text> : null}
      </View>

      {state.status === 'blocked' ? (
        <AppButton title="Open phone settings" onPress={() => Linking.openSettings()} style={styles.button} />
      ) : null}
      {state.status === 'denied' ? (
        <AppButton title="Turn on notifications" onPress={refresh} loading={busy} style={styles.button} />
      ) : null}

      {/* Alert radius (donors only) */}
      <View style={styles.card}>
        <Text style={styles.title}>Alert radius</Text>
        {donor === undefined ? (
          <Text style={styles.message}>Loading...</Text>
        ) : donor === null ? (
          <Text style={styles.message}>Register as a donor to receive blood request alerts.</Text>
        ) : (
          <View>
            <Text style={styles.message}>
              You are alerted about compatible blood requests within this distance of your saved location.
              Choose Off to stop alerts.
            </Text>
            <View style={styles.radiusRow}>
              <OptionSelector options={RADIUS_OPTIONS} value={toLabel(currentRadius)} onChange={changeRadius} />
            </View>
            {savingRadius ? <Text style={styles.message}>Saving...</Text> : null}
            {!donor.geohash ? (
              <Text style={styles.warn}>
                You have no saved GPS location, so no alerts can reach you. Save it on the Donor tab.
              </Text>
            ) : null}
            {!donor.available ? (
              <Text style={styles.warn}>
                You are currently unavailable, so you will not be alerted until you are available again.
              </Text>
            ) : null}
          </View>
        )}
      </View>

      <AppButton title="Open notification inbox" onPress={() => navigation.navigate('Inbox')} style={styles.button} />
      <AppButton
        variant="outline"
        title="Send test notification"
        onPress={sendTest}
        disabled={!granted || !state.token || busy}
        style={styles.button}
      />
      {__DEV__ ? (
        <AppButton
          variant="outline"
          title="Measure delivery time (5 messages)"
          onPress={runLatencyTest}
          disabled={!granted || !state.token || busy}
          style={styles.button}
        />
      ) : null}
      <AppButton variant="text" title="Check again" onPress={refresh} disabled={busy} style={styles.button} />

      <View style={styles.logBox}>
        <Text style={styles.logTitle}>Log</Text>
        {log.length === 0 ? <Text style={styles.logLine}>Nothing yet.</Text> : null}
        {log.map((line, index) => (
          <Text key={index} style={styles.logLine}>
            {line}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 8 },
  line: { fontSize: 15, color: colors.textPrimary, marginBottom: 4 },
  message: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
  warn: { fontSize: 13, color: colors.warning, marginTop: 6 },
  radiusRow: { marginTop: 10 },
  button: { marginBottom: 10 },
  logBox: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginTop: 6,
  },
  logTitle: { fontSize: 14, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 6 },
  logLine: { fontSize: 13, color: colors.textPrimary, marginBottom: 4 },
});