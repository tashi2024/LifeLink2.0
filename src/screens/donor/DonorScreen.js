// src/screens/donor/DonorScreen.js
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import {
  observeMyDonor,
  deleteMyDonor,
  setAvailability,
  recordDonation,
  undoDonation,
  getCooldownDays,
} from '../../services/donor/donorService';
import AppButton from '../../components/AppButton';
import DonorLocationCard from '../../components/DonorLocationCard';
import { formatDate } from '../../utils/dateUtils';
import { DAY_MS, daysLeft } from '../../utils/donorAvailability';
import { colors } from '../../utils/theme';

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function DonorScreen({ navigation }) {
  const [donor, setDonor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false); // true while an availability change is being saved

  // Subscribe to the donor profile while this screen exists
  useEffect(() => {
    const unsubscribe = observeMyDonor(
      (data) => {
        setDonor(data);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        Alert.alert('Could not load donor profile', error.message);
      }
    );
    return unsubscribe;
  }, []);

  // Runs an availability action, shows any error, and keeps the controls disabled meanwhile
  const runAction = async (action, errorTitle) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      Alert.alert(errorTitle, error.message);
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = (value) => runAction(() => setAvailability(value), 'Could not update availability');

  const confirmDonation = async () => {
    const days = await getCooldownDays();
    const next = Date.now() + days * DAY_MS;
    Alert.alert(
      'Record donation?',
      `You will be marked unavailable for ${days} days and eligible again on ${formatDate(next)}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, I donated', onPress: () => runAction(recordDonation, 'Could not record donation') },
      ]
    );
  };

  const confirmUndo = () => {
    Alert.alert(
      'Undo donation record?',
      'This ends your cooldown and makes you available again. Use this only if you recorded a donation by mistake.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Undo', style: 'destructive', onPress: () => runAction(undoDonation, 'Could not undo') },
      ]
    );
  };

  const confirmDelete = () => {
    Alert.alert('Delete donor profile?', 'This cannot be undone. You can register again later.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteMyDonor();
          } catch (error) {
            Alert.alert('Delete failed', error.message);
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // No donor profile yet
  if (!donor) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>You are not a donor yet</Text>
        <Text style={styles.emptyText}>You do not have a donor profile yet. Register to help patients in need.</Text>
        <AppButton title="Register as donor" onPress={() => navigation.navigate('DonorForm')} style={styles.fullWidth} />
      </View>
    );
  }

  // Donor profile exists
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Profile card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.bloodBadge}>
            <Text style={styles.bloodBadgeText}>{donor.bloodGroup}</Text>
          </View>
          <View style={[styles.statusPill, donor.available ? styles.pillOn : styles.pillOff]}>
            <Text style={styles.statusText}>{donor.available ? 'Available' : 'Unavailable'}</Text>
          </View>
        </View>

        <InfoRow label="Name" value={donor.name} />
        <InfoRow label="Contact" value={donor.contactNumber} />
        <InfoRow label="Location" value={donor.location} />
      </View>

      {/* Availability card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Availability</Text>

        {donor.inCooldown ? (
          <View>
            <Text style={styles.cooldownText}>
              Thank you for donating! You are resting and hidden from searches and alerts until you are eligible again.
            </Text>
            <Text style={styles.eligible}>
              Eligible again on {formatDate(donor.nextEligibleDate)} ({daysLeft(donor.nextEligibleDate)} day
              {daysLeft(donor.nextEligibleDate) === 1 ? '' : 's'} left)
            </Text>
            {donor.lastDonationDate > 0 ? (
              <Text style={styles.hint}>Last donation: {formatDate(donor.lastDonationDate)}</Text>
            ) : null}
            <AppButton variant="text" title="Recorded by mistake? Undo" onPress={confirmUndo} disabled={busy} />
          </View>
        ) : (
          <View>
            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={styles.switchTitle}>Available to donate</Text>
                <Text style={styles.hint}>When off, you are hidden from searches and alerts.</Text>
              </View>
              <Switch
                value={donor.available}
                onValueChange={handleToggle}
                disabled={busy}
                trackColor={{ true: colors.primaryLight, false: colors.border }}
                thumbColor={donor.available ? colors.primary : '#f4f3f4'}
              />
            </View>
            {donor.lastDonationDate > 0 ? (
              <Text style={styles.hint}>Last donation: {formatDate(donor.lastDonationDate)}</Text>
            ) : null}
            <AppButton
              title="I donated today"
              variant="outline"
              onPress={confirmDonation}
              disabled={busy}
              style={styles.donatedButton}
            />
          </View>
        )}
      </View>

      {/* GPS location card (new in 7B-1) */}
      <DonorLocationCard donor={donor} />

      <AppButton title="Edit profile" onPress={() => navigation.navigate('DonorForm', { donor })} />
      <AppButton
        title="Delete donor profile"
        variant="outline"
        onPress={confirmDelete}
        loading={deleting}
        style={styles.gap}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  emptyTitle: { fontSize: 22, fontWeight: 'bold', color: colors.primary, marginBottom: 8 },
  emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  fullWidth: { alignSelf: 'stretch' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  bloodBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloodBadgeText: { color: colors.white, fontSize: 18, fontWeight: 'bold' },
  statusPill: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16 },
  pillOn: { backgroundColor: colors.success },
  pillOff: { backgroundColor: colors.textSecondary },
  statusText: { color: colors.white, fontWeight: '600' },
  infoRow: { flexDirection: 'row', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  infoLabel: { width: 80, fontSize: 14, color: colors.textSecondary },
  infoValue: { flex: 1, fontSize: 16, color: colors.textPrimary },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  switchText: { flex: 1, paddingRight: 12 },
  switchTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  hint: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  cooldownText: { fontSize: 15, color: colors.textPrimary, marginBottom: 8 },
  eligible: { fontSize: 16, fontWeight: '600', color: colors.primary, marginBottom: 6 },
  donatedButton: { marginTop: 12 },
  gap: { marginTop: 12 },
});