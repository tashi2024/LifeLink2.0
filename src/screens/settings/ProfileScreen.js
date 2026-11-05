// src/screens/settings/ProfileScreen.js
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { observeMyDonor } from '../../services/donor/donorService';
import AppButton from '../../components/AppButton';
import { confirmLogout } from '../../utils/session';
import { colors } from '../../utils/theme';

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const { user, profile, refreshProfile, logout } = useAuth();
  const [donor, setDonor] = useState(null);

  // If the account profile was missing at login, try loading it once more
  useEffect(() => {
    if (!profile) refreshProfile();
  }, []);

  // Show the donor blood group (and status) if the user is a donor
  useEffect(() => observeMyDonor(setDonor), []);

  const displayName = profile?.name || 'LifeLink user';
  const donorText = donor
    ? `Donor, ${donor.bloodGroup} (${donor.available ? 'Available' : 'Unavailable'})`
    : 'Not registered as a donor';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={44} color={colors.white} />
        </View>
        <Text style={styles.name}>{displayName}</Text>
      </View>

      <View style={styles.card}>
        <InfoRow icon="mail-outline" label="Email" value={user?.email ?? ''} />
        <InfoRow icon="call-outline" label="Phone" value={profile?.phone || 'Not set'} />
        <InfoRow icon="water-outline" label="Donor status" value={donorText} />
      </View>

      {!profile ? (
        <Text style={styles.note}>Profile details were not found for this account.</Text>
      ) : null}

      <AppButton
        title="Notification settings"
        variant="outline"
        onPress={() => navigation.navigate('NotificationSettings')}
      />
      <AppButton title="Log out" onPress={() => confirmLogout(logout)} style={styles.gap} />

      {/* Only visible while developing (never in a finished build) */}
      {__DEV__ ? (
        <AppButton
          title="Developer tools (testing only)"
          variant="outline"
          onPress={() => navigation.navigate('DevTools')}
          style={styles.devButton}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  hero: { alignItems: 'center', marginBottom: 20 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  name: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoText: { marginLeft: 14, flex: 1 },
  infoLabel: { fontSize: 13, color: colors.textSecondary },
  infoValue: { fontSize: 16, color: colors.textPrimary },
  note: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  gap: { marginTop: 12 },
  devButton: { marginTop: 24 },
});