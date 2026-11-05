// src/screens/requests/RequestDetailScreen.js
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { observeMyDonor } from '../../services/donor/donorService';
import { observeMyAppointments } from '../../services/appointments/appointmentService';
import {
  getUserContact,
  observeMyResponse,
  observeRequest,
  respondToRequest,
} from '../../services/requests/responseService';
import AppButton from '../../components/AppButton';
import { compatibleDonorGroups } from '../../utils/bloodCompatibility';
import { describeSlot } from '../../utils/appointmentUtils';
import { callNumber } from '../../utils/contact';
import { formatDate } from '../../utils/dateUtils';
import { ALLOW_SELF_RESPONSE } from '../../utils/testFlags';
import { colors } from '../../utils/theme';

const URGENCY_COLORS = {
  Low: colors.success,
  Medium: colors.warning,
  High: '#E64A19',
  Critical: colors.primaryDark,
};
const STATUS_COLORS = {
  Open: colors.secondary,
  Fulfilled: colors.success,
  Cancelled: colors.textSecondary,
};

function Pill({ text, color }) {
  return (
    <View style={[styles.pill, { backgroundColor: color }]}>
      <Text style={styles.pillText}>{text}</Text>
    </View>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function RequestDetailScreen({ navigation, route }) {
  const requestId = route.params?.requestId;
  const { user } = useAuth();

  const [request, setRequest] = useState(undefined);   // undefined = loading, null = not found
  const [donor, setDonor] = useState(undefined);       // undefined = loading, null = not a donor
  const [response, setResponse] = useState(undefined); // undefined = loading, null = no answer yet
  const [requester, setRequester] = useState(null);    // { name, phone } shown after the donor accepts
  const [appointments, setAppointments] = useState([]); // my appointments (for the booking card)
  const [sending, setSending] = useState('');          // 'accepted' | 'declined' | ''

  useEffect(() => {
    if (!requestId) {
      setRequest(null);
      return undefined;
    }
    const stopRequest = observeRequest(requestId, setRequest, () => setRequest(null));
    const stopDonor = observeMyDonor(setDonor, () => setDonor(null));
    const stopResponse = observeMyResponse(requestId, setResponse, () => setResponse(null));
    const stopAppointments = observeMyAppointments(setAppointments, () => setAppointments([]));
    return () => {
      stopRequest();
      stopDonor();
      stopResponse();
      stopAppointments();
    };
  }, [requestId]);

  // After the donor accepts, show how to reach the requester
  useEffect(() => {
    if (request?.userId && response?.status === 'accepted') {
      getUserContact(request.userId).then(setRequester);
    }
  }, [request?.userId, response?.status]);

  if (request === undefined || donor === undefined || response === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (request === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundTitle}>Request not found</Text>
        <Text style={styles.notFoundText}>This request no longer exists.</Text>
      </View>
    );
  }

  const isOwn = request.userId === user?.uid;
  const isOpen = request.status === 'Open';
  const compatible = donor ? compatibleDonorGroups(request.bloodGroup).includes(donor.bloodGroup) : false;
  const canAnswer = isOpen && Boolean(donor) && (!isOwn || ALLOW_SELF_RESPONSE);
  const canAccept = canAnswer && compatible && donor.available;

  // Appointments: the donor's upcoming ones, and the one linked to this request (if any)
  const nowMs = Date.now();
  const upcomingAppointments = appointments.filter((a) => a.status === 'booked' && a.scheduledAt > nowMs);
  const linkedAppointment = upcomingAppointments.find((a) => a.requestId === requestId);
  const showAppointmentCard = response?.status === 'accepted' && (isOpen || Boolean(linkedAppointment));

  const send = async (status) => {
    setSending(status);
    try {
      const result = await respondToRequest(request, status);
      if (status === 'accepted') {
        Alert.alert(
          'Thank you!',
          result.notified
            ? 'The requester has been notified and can see your contact number.'
            : 'Your answer is saved and the requester will see it in the app. They could not be notified right now.'
        );
      } else {
        Alert.alert('Answer saved', 'The requester has been told that you are not available.');
      }
    } catch (error) {
      Alert.alert('Could not send your answer', error.message);
    } finally {
      setSending('');
    }
  };

  const confirmAccept = () =>
    Alert.alert('Confirm', 'Your name and phone number will be shared with the person who made this request.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'I can donate', onPress: () => send('accepted') },
    ]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* The request */}
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.bloodBadge}>
            <Text style={styles.bloodBadgeText}>{request.bloodGroup}</Text>
          </View>
          <View style={styles.pills}>
            <Pill text={request.urgency} color={URGENCY_COLORS[request.urgency] || colors.warning} />
            <Pill text={request.status} color={STATUS_COLORS[request.status] || colors.secondary} />
          </View>
        </View>
        <Row label="Location" value={request.location} />
        <Row label="Units needed" value={String(request.quantity)} />
        {request.notes ? <Row label="Notes" value={request.notes} /> : null}
        <Row label="Posted" value={formatDate(request.createdAt)} />
      </View>

      {/* Own request (when testing mode is off) */}
      {isOwn && !ALLOW_SELF_RESPONSE ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>This is your request</Text>
          <AppButton
            title="See responses"
            onPress={() => navigation.navigate('RequestResponses', { requestId })}
          />
        </View>
      ) : !donor ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Want to help?</Text>
          <Text style={styles.text}>Register as a donor to answer blood requests.</Text>
          <AppButton title="Register as donor" onPress={() => navigation.navigate('DonorForm')} style={styles.gap} />
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Can you help?</Text>

          {isOwn ? <Text style={styles.testNote}>Testing mode: you are answering your own request.</Text> : null}

          {response ? (
            <Text style={styles.answer}>
              Your answer: {response.status === 'accepted' ? 'I can donate' : 'Not available'}
            </Text>
          ) : null}

          {!isOpen ? (
            <Text style={styles.warn}>This request is {request.status.toLowerCase()}, so answers are closed.</Text>
          ) : null}
          {isOpen && !compatible ? (
            <Text style={styles.warn}>
              Your blood group ({donor.bloodGroup}) cannot donate to a {request.bloodGroup} patient.
            </Text>
          ) : null}
          {isOpen && compatible && !donor.available ? (
            <Text style={styles.warn}>
              You are marked unavailable (switched off, or resting after a donation). Turn on availability to
              accept.
            </Text>
          ) : null}

          <AppButton
            title="I can donate"
            onPress={confirmAccept}
            disabled={!canAccept || response?.status === 'accepted' || Boolean(sending)}
            loading={sending === 'accepted'}
            style={styles.gap}
          />
          <AppButton
            title="Not available"
            variant="outline"
            onPress={() => send('declined')}
            disabled={!canAnswer || response?.status === 'declined' || Boolean(sending)}
            loading={sending === 'declined'}
            style={styles.gap}
          />
        </View>
      )}

      {/* Requester contact, only after the donor has accepted */}
      {response?.status === 'accepted' && requester?.phone ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Requester</Text>
          <Row label="Name" value={requester.name || 'Not given'} />
          <Row label="Phone" value={requester.phone} />
          <AppButton title="Call requester" onPress={() => callNumber(requester.phone)} style={styles.gap} />
        </View>
      ) : null}

      {/* Plan the donation: book an appointment linked to this request */}
      {showAppointmentCard ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Donation appointment</Text>
          {linkedAppointment ? (
            <View>
              <Text style={styles.text}>{linkedAppointment.facilityName}</Text>
              <Text style={styles.answer}>{describeSlot(linkedAppointment.scheduledAt)}</Text>
              <AppButton
                title="View appointments"
                variant="outline"
                onPress={() => navigation.navigate('Appointments')}
                style={styles.gap}
              />
            </View>
          ) : upcomingAppointments.length > 0 ? (
            <View>
              <Text style={styles.text}>
                You already have an upcoming appointment. You can have one at a time, so change or cancel it first.
              </Text>
              <AppButton
                title="View appointments"
                variant="outline"
                onPress={() => navigation.navigate('Appointments')}
                style={styles.gap}
              />
            </View>
          ) : (
            <View>
              <Text style={styles.text}>
                In an emergency, call the requester now. To plan your donation at a hospital or blood bank, book a
                time slot.
              </Text>
              <AppButton
                title="Book a donation appointment"
                onPress={() => navigation.navigate('BookAppointment', { requestId })}
                style={styles.gap}
              />
            </View>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  notFoundTitle: { fontSize: 20, fontWeight: 'bold', color: colors.primary, marginBottom: 6 },
  notFoundText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  bloodBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloodBadgeText: { color: colors.white, fontSize: 20, fontWeight: 'bold' },
  pills: { flexDirection: 'row' },
  pill: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 14, marginLeft: 6 },
  pillText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  rowLabel: { width: 100, fontSize: 14, color: colors.textSecondary },
  rowValue: { flex: 1, fontSize: 16, color: colors.textPrimary },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 8 },
  text: { fontSize: 15, color: colors.textPrimary },
  answer: { fontSize: 15, fontWeight: '600', color: colors.primary, marginBottom: 6 },
  warn: { fontSize: 14, color: colors.textSecondary, marginBottom: 6 },
  testNote: { fontSize: 13, color: colors.warning, marginBottom: 8 },
  gap: { marginTop: 10 },
});