// src/screens/appointments/BookAppointmentScreen.js
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { observeMyDonor } from '../../services/donor/donorService';
import {
  bookAppointment,
  getSlotAvailability,
  observeMyAppointments,
  rescheduleAppointment,
} from '../../services/appointments/appointmentService';
import { observeRequest } from '../../services/requests/responseService';
import { REMINDER_LEAD_MS } from '../../services/notifications/appointmentReminders';
import SelectField from '../../components/SelectField';
import AppButton from '../../components/AppButton';
import {
  BOOKING_WINDOW_DAYS,
  FACILITIES,
  MIN_LEAD_MINUTES,
  getFacility,
  isFacilityOpen,
} from '../../utils/facilities';
import { MONTHS_SHORT, WEEKDAYS, describeSlot, nextDays, slotTimestamp, toDateKey } from '../../utils/appointmentUtils';
import { formatDate } from '../../utils/dateUtils';
import { colors } from '../../utils/theme';

export default function BookAppointmentScreen({ navigation, route }) {
  const existing = route.params?.appointment; // present when rescheduling
  const requestId = route.params?.requestId;  // present when booking from a blood request
  const isReschedule = Boolean(existing);

  const [donor, setDonor] = useState(undefined); // undefined = loading, null = not a donor
  const [mine, setMine] = useState([]);          // my appointments
  const [linkedRequest, setLinkedRequest] = useState(null); // the blood request this booking is for
  const [facilityId, setFacilityId] = useState(existing?.facilityId ?? FACILITIES[0].id);
  const [dateKey, setDateKey] = useState('');
  const [timeKey, setTimeKey] = useState('');
  const [availability, setAvailability] = useState(null); // { '09:00': 2, ... } or null
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState('');
  const [saving, setSaving] = useState(false);

  const facility = getFacility(facilityId);
  const days = useMemo(() => nextDays(BOOKING_WINDOW_DAYS), []);

  useEffect(() => {
    navigation.setOptions({ title: isReschedule ? 'Reschedule appointment' : 'Book appointment' });
  }, [navigation, isReschedule]);

  useEffect(() => observeMyDonor(setDonor, () => setDonor(null)), []);
  useEffect(() => observeMyAppointments(setMine, () => setMine([])), []);

  // When opened from a blood request, load it so the screen can say what the booking is for
  useEffect(() => {
    if (!requestId) return undefined;
    return observeRequest(requestId, setLinkedRequest, () => setLinkedRequest(null));
  }, [requestId]);

  // Load the free places for the chosen place and day
  useEffect(() => {
    if (!dateKey) {
      setAvailability(null);
      setSlotError('');
      return undefined;
    }
    let cancelled = false;
    setLoadingSlots(true);
    setAvailability(null);
    setSlotError('');
    getSlotAvailability(facilityId, dateKey)
      .then((result) => {
        if (!cancelled) setAvailability(result);
      })
      .catch((error) => {
        if (!cancelled) setSlotError(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [facilityId, dateKey]);

  const hasUpcoming = mine.some((a) => a.status === 'booked' && a.scheduledAt > Date.now());
  const blockedByExisting = !isReschedule && hasUpcoming;
  const earliestKey = donor?.inCooldown ? toDateKey(new Date(donor.nextEligibleDate)) : '';

  const dayDisabled = (day) =>
    !isFacilityOpen(facility, day.date) || (earliestKey !== '' && day.dateKey < earliestKey);

  const handleFacility = (name) => {
    const next = FACILITIES.find((f) => f.name === name);
    if (!next) return;
    setFacilityId(next.id);
    setTimeKey('');
    if (dateKey) {
      const day = days.find((d) => d.dateKey === dateKey);
      if (!day || !isFacilityOpen(next, day.date)) setDateKey('');
    }
  };

  const handleDate = (key) => {
    setDateKey(key);
    setTimeKey('');
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const scheduledAt = slotTimestamp(dateKey, timeKey);
      if (isReschedule) {
        await rescheduleAppointment({ appointment: existing, facilityId, dateKey, timeKey });
      } else {
        await bookAppointment({ facilityId, dateKey, timeKey, requestId });
      }
      const reminderAt = scheduledAt - REMINDER_LEAD_MS;
      const reminderText =
        reminderAt > Date.now()
          ? `A reminder will arrive on ${describeSlot(reminderAt)}.`
          : 'There is no 24-hour reminder because the appointment is less than 24 hours away.';
      const linkText = requestId && !isReschedule ? '\n\nThis appointment is linked to the blood request.' : '';
      Alert.alert(
        isReschedule ? 'Appointment updated' : 'Appointment booked',
        `${facility.name}\n${describeSlot(scheduledAt)}\n\n${reminderText}${linkText}`
      );
      navigation.goBack();
    } catch (error) {
      Alert.alert('Could not save the appointment', error.message);
    } finally {
      setSaving(false);
    }
  };

  if (donor === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (donor === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Register as a donor first</Text>
        <Text style={styles.emptyText}>You need a donor profile to book a donation appointment.</Text>
        <AppButton title="Register as donor" onPress={() => navigation.navigate('DonorForm')} style={styles.fullWidth} />
      </View>
    );
  }

  const chosenTime = dateKey && timeKey ? slotTimestamp(dateKey, timeKey) : 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {requestId && linkedRequest ? (
        <View style={styles.requestBanner}>
          <Text style={styles.requestTitle}>For a blood request</Text>
          <Text style={styles.requestLine}>
            {linkedRequest.bloodGroup} · {linkedRequest.urgency} · {linkedRequest.location}
          </Text>
          <Text style={styles.hint}>
            In an emergency, call the requester first. An appointment helps you plan your donation.
          </Text>
        </View>
      ) : null}

      {blockedByExisting ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            You already have an upcoming appointment. You can have one at a time, so reschedule or cancel it
            first.
          </Text>
          <AppButton variant="text" title="View my appointments" onPress={() => navigation.goBack()} />
        </View>
      ) : null}

      {donor.inCooldown ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            You are resting after a donation. You can book from {formatDate(donor.nextEligibleDate)}. Earlier dates
            are greyed out.
          </Text>
        </View>
      ) : null}

      <SelectField
        label="Hospital or blood bank"
        value={facility.name}
        options={FACILITIES.map((f) => f.name)}
        onChange={handleFacility}
      />
      <Text style={styles.facilityInfo}>
        {facility.type} · {facility.dzongkhag} · open Monday to Friday
      </Text>

      <Text style={styles.label}>Date</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayStrip}>
        {days.map((day) => {
          const disabled = dayDisabled(day);
          const selected = day.dateKey === dateKey;
          return (
            <TouchableOpacity
              key={day.dateKey}
              disabled={disabled}
              onPress={() => handleDate(day.dateKey)}
              activeOpacity={0.8}
              style={[styles.day, selected && styles.daySelected, disabled && styles.dayDisabled]}
            >
              <Text style={[styles.dayName, selected && styles.dayTextSelected]}>{WEEKDAYS[day.date.getDay()]}</Text>
              <Text style={[styles.dayNumber, selected && styles.dayTextSelected]}>{day.date.getDate()}</Text>
              <Text style={[styles.dayMonth, selected && styles.dayTextSelected]}>{MONTHS_SHORT[day.date.getMonth()]}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.label}>Time</Text>
      {!dateKey ? (
        <Text style={styles.hint}>Pick a date to see the time slots.</Text>
      ) : loadingSlots ? (
        <ActivityIndicator color={colors.primary} style={styles.slotSpinner} />
      ) : slotError ? (
        <Text style={styles.error}>{slotError}</Text>
      ) : (
        <View style={styles.slotRow}>
          {facility.slots.map((t) => {
            const remaining = availability?.[t];
            const startsAt = slotTimestamp(dateKey, t);
            const past = startsAt < Date.now() + MIN_LEAD_MINUTES * 60 * 1000;
            const isCurrent =
              isReschedule && existing.facilityId === facilityId && existing.dateKey === dateKey && existing.timeKey === t;
            const full = remaining === 0;
            const disabled = past || full || isCurrent;
            const selected = t === timeKey;
            const caption = isCurrent ? 'Current' : past ? 'Passed' : full ? 'Full' : `${remaining ?? '?'} left`;
            return (
              <TouchableOpacity
                key={t}
                disabled={disabled}
                onPress={() => setTimeKey(t)}
                activeOpacity={0.8}
                style={[styles.slot, selected && styles.slotSelected, disabled && styles.slotDisabled]}
              >
                <Text style={[styles.slotTime, selected && styles.slotTextSelected]}>{t}</Text>
                <Text style={[styles.slotCaption, selected && styles.slotTextSelected]}>{caption}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {chosenTime ? (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>{isReschedule ? 'New time' : 'Your appointment'}</Text>
          <Text style={styles.summaryLine}>{facility.fullName}</Text>
          <Text style={styles.summaryLine}>{describeSlot(chosenTime)}</Text>
          <Text style={styles.hint}>
            {chosenTime - REMINDER_LEAD_MS > Date.now()
              ? `Reminder: ${describeSlot(chosenTime - REMINDER_LEAD_MS)}`
              : 'No 24-hour reminder (the appointment is less than 24 hours away).'}
          </Text>
        </View>
      ) : null}

      <AppButton
        title={isReschedule ? 'Confirm new time' : 'Confirm booking'}
        onPress={handleConfirm}
        loading={saving}
        disabled={!dateKey || !timeKey || blockedByExisting}
        style={styles.confirm}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: colors.primary, marginBottom: 6 },
  emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 },
  fullWidth: { alignSelf: 'stretch' },
  requestBanner: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
    padding: 12,
    marginBottom: 14,
  },
  requestTitle: { fontSize: 13, fontWeight: 'bold', color: colors.primary, marginBottom: 2 },
  requestLine: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  notice: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: 12,
    marginBottom: 14,
  },
  noticeText: { fontSize: 14, color: colors.textPrimary },
  facilityInfo: { fontSize: 13, color: colors.textSecondary, marginTop: -8, marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  hint: { fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
  error: { fontSize: 14, color: colors.error, marginBottom: 8 },
  dayStrip: { marginBottom: 16, flexGrow: 0 },
  day: {
    width: 62,
    alignItems: 'center',
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  daySelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayDisabled: { opacity: 0.35 },
  dayName: { fontSize: 12, color: colors.textSecondary },
  dayNumber: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
  dayMonth: { fontSize: 12, color: colors.textSecondary },
  dayTextSelected: { color: colors.white },
  slotSpinner: { marginVertical: 16 },
  slotRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  slot: {
    minWidth: 92,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  slotSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotDisabled: { opacity: 0.4 },
  slotTime: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  slotCaption: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  slotTextSelected: { color: colors.white },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 8,
    marginBottom: 8,
  },
  summaryTitle: { fontSize: 15, fontWeight: 'bold', color: colors.primary, marginBottom: 4 },
  summaryLine: { fontSize: 15, color: colors.textPrimary, marginBottom: 2 },
  confirm: { marginTop: 12 },
});