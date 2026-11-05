// src/screens/home/HomeScreen.js
import { useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { observeMyDonor } from '../../services/donor/donorService';
import { observeMyRequests } from '../../services/requests/requestService';
import { observeMyAppointments } from '../../services/appointments/appointmentService';
import AppButton from '../../components/AppButton';
import { describeSlot } from '../../utils/appointmentUtils';
import { confirmLogout } from '../../utils/session';
import { colors } from '../../utils/theme';

function StatBox({ title, value }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );
}

function QuickAction({ icon, title, description, onPress }) {
  return (
    <TouchableOpacity style={styles.actionCard} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={24} color={colors.white} />
      </View>
      <View style={styles.actionText}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }) {
  const { user, profile, logout } = useAuth();
  const [donor, setDonor] = useState(null);
  const [requests, setRequests] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [donorLoaded, setDonorLoaded] = useState(false);
  const [requestsLoaded, setRequestsLoaded] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // Logout icon in the red header, like Project I
  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'LifeLink',
      headerRight: () => (
        <TouchableOpacity
          onPress={() => confirmLogout(logout)}
          style={styles.headerButton}
          accessibilityLabel="Log out"
        >
          <Ionicons name="log-out-outline" size={26} color={colors.white} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, logout]);

  // Live data: the dashboard updates by itself when the donor profile or requests change
  useEffect(() => {
    setError('');
    setDonorLoaded(false);
    setRequestsLoaded(false);

    const stopDonor = observeMyDonor(
      (data) => {
        setDonor(data);
        setDonorLoaded(true);
      },
      (e) => {
        setError(e.message);
        setDonorLoaded(true);
      }
    );
    const stopRequests = observeMyRequests(
      (list) => {
        setRequests(list);
        setRequestsLoaded(true);
      },
      (e) => {
        setError(e.message);
        setRequestsLoaded(true);
      }
    );
    // Appointments are optional on Home: if they fail to load, the rest of the dashboard still works
    const stopAppointments = observeMyAppointments(setAppointments, (e) =>
      console.log('Appointments unavailable on Home:', e.message)
    );

    return () => {
      stopDonor();
      stopRequests();
      stopAppointments();
    };
  }, [reloadKey]);

  const displayName = profile?.name || user?.email || 'friend';
  const openCount = requests.filter((r) => r.status === 'Open').length;
  const now = Date.now();
  const nextAppointment = appointments
    .filter((a) => a.status === 'booked' && a.scheduledAt > now)
    .sort((a, b) => a.scheduledAt - b.scheduledAt)[0];

  if (!donorLoaded || !requestsLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>{error}</Text>
        <AppButton title="Retry" onPress={() => setReloadKey((k) => k + 1)} style={styles.retry} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Welcome card */}
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeTitle}>Welcome to LifeLink! 👋</Text>
        <Text style={styles.welcomeName}>Hello, {displayName}!</Text>
        <Text style={styles.welcomeText}>Together, we can help save lives through blood donation.</Text>
      </View>

      {/* Donor status */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Donor status</Text>
        {donor ? (
          <View>
            <Text style={styles.cardText}>You are registered as a blood donor.</Text>
            <View style={styles.statusRow}>
              <Text style={styles.cardText}>Blood group: {donor.bloodGroup}</Text>
              <View style={[styles.pill, donor.available ? styles.pillOn : styles.pillOff]}>
                <Text style={styles.pillText}>{donor.available ? 'Available' : 'Unavailable'}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View>
            <Text style={styles.cardText}>You are not registered as a donor yet.</Text>
            <AppButton
              title="Register as donor"
              variant="outline"
              onPress={() => navigation.navigate('DonorForm')}
              style={styles.registerButton}
            />
          </View>
        )}
      </View>

      {/* Next appointment */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Next appointment</Text>
        {nextAppointment ? (
          <View>
            <Text style={styles.appointmentPlace}>{nextAppointment.facilityName}</Text>
            <Text style={styles.cardText}>{describeSlot(nextAppointment.scheduledAt)}</Text>
            <AppButton
              title="View appointments"
              variant="outline"
              onPress={() => navigation.navigate('Appointments')}
              style={styles.registerButton}
            />
          </View>
        ) : (
          <View>
            <Text style={styles.cardText}>You have no upcoming donation appointment.</Text>
            <AppButton
              title="Book an appointment"
              variant="outline"
              onPress={() => navigation.navigate('BookAppointment')}
              style={styles.registerButton}
            />
          </View>
        )}
      </View>

      {/* Request counts */}
      <View style={styles.statsRow}>
        <StatBox title="Open requests" value={openCount} />
        <StatBox title="Total requests" value={requests.length} />
      </View>

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>Quick actions</Text>
      <QuickAction
        icon="water"
        title="Donor profile"
        description="Register or update your donor details"
        onPress={() => navigation.navigate('Donor')}
      />
      <QuickAction
        icon="calendar"
        title="Appointments"
        description="Book, change or cancel a donation"
        onPress={() => navigation.navigate('Appointments')}
      />
      <QuickAction
        icon="medkit"
        title="My requests"
        description="Create and manage blood requests"
        onPress={() => navigation.navigate('Requests')}
      />
      <QuickAction
        icon="search"
        title="Find donors"
        description="Search for available donors"
        onPress={() => navigation.navigate('Search')}
      />
      <QuickAction
        icon="person"
        title="My profile"
        description="View your account and log out"
        onPress={() => navigation.navigate('Profile')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  loadingText: { marginTop: 12, fontSize: 15, color: colors.textSecondary },
  errorTitle: { fontSize: 20, fontWeight: 'bold', color: colors.primary, marginBottom: 8 },
  errorText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  retry: { alignSelf: 'stretch' },
  headerButton: { marginRight: 16 },
  welcomeCard: { backgroundColor: colors.primary, borderRadius: 14, padding: 20, marginBottom: 16 },
  welcomeTitle: { fontSize: 20, fontWeight: 'bold', color: colors.white },
  welcomeName: { fontSize: 16, color: colors.white, marginTop: 6 },
  welcomeText: { fontSize: 14, color: colors.white, opacity: 0.9, marginTop: 8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 8 },
  cardText: { fontSize: 15, color: colors.textPrimary },
  appointmentPlace: { fontSize: 16, fontWeight: '600', color: colors.primary, marginBottom: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  pill: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 14 },
  pillOn: { backgroundColor: colors.success },
  pillOff: { backgroundColor: colors.textSecondary },
  pillText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  registerButton: { marginTop: 12 },
  statsRow: { flexDirection: 'row', marginBottom: 16 },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontSize: 32, fontWeight: 'bold', color: colors.primary },
  statTitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 10 },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { flex: 1, marginLeft: 14 },
  actionTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  actionDescription: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
});