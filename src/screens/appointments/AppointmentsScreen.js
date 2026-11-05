// src/screens/appointments/AppointmentsScreen.js
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  cancelAppointment,
  completeAppointment,
  markMissed,
  observeMyAppointments,
} from '../../services/appointments/appointmentService';
import {
  REMINDER_LEAD_MS,
  listScheduledReminders,
  scheduleTestReminder,
} from '../../services/notifications/appointmentReminders';
import AppButton from '../../components/AppButton';
import { describeSlot } from '../../utils/appointmentUtils';
import { colors } from '../../utils/theme';

function statusInfo(a, now) {
  if (a.status === 'cancelled') return { text: 'Cancelled', color: colors.textSecondary };
  if (a.status === 'completed') return { text: 'Donated', color: colors.success };
  if (a.status === 'missed') return { text: 'Did not attend', color: colors.textSecondary };
  if (a.scheduledAt > now) return { text: 'Booked', color: colors.secondary };
  return { text: 'Awaiting confirmation', color: colors.warning };
}

function reminderLine(a, now) {
  const at = a.scheduledAt - REMINDER_LEAD_MS;
  return at > now ? `Reminder: ${describeSlot(at)}` : 'No reminder (booked less than 24 hours ahead)';
}

function AppointmentCard({ item, now, busy, onReschedule, onCancel, onDonated, onMissed, onViewRequest }) {
  const info = statusInfo(item, now);
  const upcoming = item.status === 'booked' && item.scheduledAt > now;
  const awaiting = item.status === 'booked' && item.scheduledAt <= now;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardTitle}>
          <Text style={styles.facility}>{item.facilityName}</Text>
          <Text style={styles.type}>{item.facilityType}</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: info.color }]}>
          <Text style={styles.pillText}>{info.text}</Text>
        </View>
      </View>

      <Text style={styles.when}>{describeSlot(item.scheduledAt)}</Text>
      {upcoming ? <Text style={styles.reminder}>{reminderLine(item, now)}</Text> : null}

      {item.requestId ? (
        <TouchableOpacity style={styles.linkRow} onPress={() => onViewRequest(item)}>
          <Ionicons name="link-outline" size={16} color={colors.secondary} />
          <Text style={styles.linkText}>Linked to a blood request · View</Text>
        </TouchableOpacity>
      ) : null}

      {upcoming ? (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => onReschedule(item)} disabled={busy}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <Text style={styles.actionText}>Reschedule</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => onCancel(item)} disabled={busy}>
            {busy ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="close-circle-outline" size={20} color={colors.primary} />
            )}
            <Text style={styles.actionText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {awaiting ? (
        <View>
          <Text style={styles.reminder}>Did you donate at this appointment?</Text>
          <View style={styles.buttonRow}>
            <AppButton title="I donated" onPress={() => onDonated(item)} loading={busy} style={styles.half} />
            <AppButton title="I did not go" variant="outline" onPress={() => onMissed(item)} disabled={busy} style={styles.half} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function AppointmentsScreen({ navigation }) {
  const [items, setItems] = useState(undefined); // undefined = loading
  const [error, setError] = useState('');
  const [mode, setMode] = useState('upcoming');
  const [busyId, setBusyId] = useState('');

  useEffect(
    () =>
      observeMyAppointments(setItems, (e) => {
        setError(e.message);
        setItems([]);
      }),
    []
  );

  const run = async (item, task, errorTitle) => {
    setBusyId(item.id);
    try {
      await task();
    } catch (e) {
      Alert.alert(errorTitle, e.message);
    } finally {
      setBusyId('');
    }
  };

  const confirmCancel = (item) =>
    Alert.alert('Cancel appointment?', 'Your place will be given to another donor.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel appointment', style: 'destructive', onPress: () => run(item, () => cancelAppointment(item), 'Could not cancel') },
    ]);

  const confirmDonated = (item) =>
    Alert.alert(
      'Record your donation?',
      'This also starts your donation cooldown, so you will be hidden from searches and alerts until you are eligible again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, I donated', onPress: () => run(item, () => completeAppointment(item), 'Could not record donation') },
      ]
    );

  const confirmMissed = (item) =>
    Alert.alert('Mark as not attended?', 'This closes the appointment. You can book a new one any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: () => run(item, () => markMissed(item), 'Could not update') },
    ]);

  const openBooking = (appointment) =>
    navigation.navigate('BookAppointment', appointment ? { appointment } : undefined);

  const viewRequest = (appointment) => navigation.navigate('RequestDetail', { requestId: appointment.requestId });

  // Developer helpers
  const devList = async () => {
    try {
      const list = await listScheduledReminders();
      Alert.alert('Scheduled reminders', list.length ? list.join('\n\n') : 'None scheduled.');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };
  const devTest = async () => {
    try {
      await scheduleTestReminder();
      Alert.alert('Scheduled', 'A test reminder will arrive in 60 seconds. Try closing the app.');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  if (items === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const now = Date.now();
  const isUpcoming = (a) => a.status === 'booked' && a.scheduledAt > now;
  const upcoming = items.filter(isUpcoming).sort((a, b) => a.scheduledAt - b.scheduledAt);
  const past = items.filter((a) => !isUpcoming(a)).sort((a, b) => b.scheduledAt - a.scheduledAt);
  const shown = mode === 'upcoming' ? upcoming : past;

  const header = (
    <View style={styles.modeRow}>
      {[
        ['upcoming', `Upcoming (${upcoming.length})`],
        ['past', `Past (${past.length})`],
      ].map(([key, label]) => (
        <TouchableOpacity
          key={key}
          style={[styles.modeButton, mode === key && styles.modeButtonActive]}
          onPress={() => setMode(key)}
        >
          <Text style={[styles.modeText, mode === key && styles.modeTextActive]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const footer = __DEV__ ? (
    <View style={styles.dev}>
      <Text style={styles.devTitle}>Developer tools</Text>
      <AppButton variant="outline" title="List scheduled reminders" onPress={devList} style={styles.devButton} />
      <AppButton variant="outline" title="Test reminder in 1 minute" onPress={devTest} style={styles.devButton} />
    </View>
  ) : null;

  return (
    <View style={styles.screen}>
      <FlatList
        data={shown}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {error ? 'Something went wrong' : mode === 'upcoming' ? 'No upcoming appointments' : 'No past appointments'}
            </Text>
            <Text style={styles.emptyText}>
              {error ||
                (mode === 'upcoming'
                  ? 'Book a donation at a hospital or blood bank near you.'
                  : 'Finished and cancelled appointments will appear here.')}
            </Text>
            {mode === 'upcoming' && !error ? (
              <AppButton title="Book an appointment" onPress={() => openBooking()} style={styles.fullWidth} />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <AppointmentCard
            item={item}
            now={now}
            busy={busyId === item.id}
            onReschedule={openBooking}
            onCancel={confirmCancel}
            onDonated={confirmDonated}
            onMissed={confirmMissed}
            onViewRequest={viewRequest}
          />
        )}
      />

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => openBooking()}>
        <Ionicons name="add" size={32} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 100 },
  modeRow: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: 10, padding: 3, marginBottom: 14 },
  modeButton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  modeButtonActive: { backgroundColor: colors.primary },
  modeText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  modeTextActive: { color: colors.white },
  empty: { alignItems: 'center', padding: 16 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 6 },
  emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  fullWidth: { alignSelf: 'stretch' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  cardTitle: { flex: 1, paddingRight: 8 },
  facility: { fontSize: 17, fontWeight: 'bold', color: colors.textPrimary },
  type: { fontSize: 13, color: colors.textSecondary },
  pill: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 14 },
  pillText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  when: { fontSize: 16, color: colors.primary, fontWeight: '600', marginTop: 4 },
  reminder: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
  linkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  linkText: { fontSize: 13, color: colors.secondary, fontWeight: '600', marginLeft: 4 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: { flexDirection: 'row', alignItems: 'center', marginLeft: 20, paddingVertical: 4 },
  actionText: { color: colors.primary, fontWeight: '600', marginLeft: 4 },
  buttonRow: { flexDirection: 'row', marginTop: 8 },
  half: { flex: 1, marginHorizontal: 4 },
  dev: { marginTop: 20, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  devTitle: { fontSize: 14, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 8 },
  devButton: { marginBottom: 8 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});