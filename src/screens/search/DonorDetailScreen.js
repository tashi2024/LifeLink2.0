// src/screens/search/DonorDetailScreen.js
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppButton from '../../components/AppButton';
import { callNumber } from '../../utils/contact';
import { colors } from '../../utils/theme';

function InfoRow({ icon, label, value, valueColor }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
      </View>
    </View>
  );
}

export default function DonorDetailScreen({ route }) {
  const donor = route.params?.donor;

  if (!donor) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Donor not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={44} color={colors.white} />
        </View>
        <Text style={styles.name}>{donor.name}</Text>
        <Text style={styles.subtitle}>Blood donor</Text>
      </View>

      <View style={styles.bloodCard}>
        <Text style={styles.bloodGroup}>{donor.bloodGroup}</Text>
        <Text style={styles.bloodLabel}>Blood group</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Contact information</Text>
        <InfoRow icon="call-outline" label="Contact number" value={donor.contactNumber} />
        <InfoRow icon="location-outline" label="Location" value={donor.location} />
        <InfoRow
          icon={donor.available ? 'checkmark-circle-outline' : 'close-circle-outline'}
          label="Availability"
          value={donor.available ? 'Available to donate' : 'Not available'}
          valueColor={donor.available ? colors.success : colors.textSecondary}
        />
      </View>

      <AppButton title="Call donor" onPress={() => callNumber(donor.contactNumber)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  notFound: { fontSize: 18, color: colors.textSecondary },
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
  subtitle: { fontSize: 14, color: colors.textSecondary },
  bloodCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bloodGroup: { fontSize: 40, fontWeight: 'bold', color: colors.primary },
  bloodLabel: { fontSize: 14, color: colors.textSecondary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  infoText: { marginLeft: 14, flex: 1 },
  infoLabel: { fontSize: 13, color: colors.textSecondary },
  infoValue: { fontSize: 16, color: colors.textPrimary },
});